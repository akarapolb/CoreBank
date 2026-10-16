package org.fabor.lending;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.fabor.engine.lease.FinanceLease;
import org.fabor.engine.lease.OperatingLease;
import org.fabor.engine.schedule.Frequency;
import org.fabor.ledger.application.LedgerService;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.ledger.domain.Direction;
import org.fabor.ledger.domain.Entry;
import org.fabor.ledger.domain.PostingBatch;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.IdempotencyKey;
import org.fabor.platform.tenancy.TenantId;
import org.fabor.platform.time.BusinessCalendar;
import org.fabor.platform.time.BusinessCalendar.Convention;

/**
 * Lessor accounting and servicing for leases (TFRS 16) on the ledger.
 *
 * <p>Finance lease: the asset leaves the books at inception and a net investment in the lease is recognised (debit net
 * investment, credit supplier payable). Each period earns finance income at the implicit rate (debit net investment,
 * credit finance income); customer payments reduce the net investment. Operating lease: the leased asset stays on the
 * books (debit leased assets) and each period bills rent to a receivable, recognises straight-line rent against it (the
 * cumulative difference sits in one accrued-or-deferred rent account) and depreciates the asset. Accrual is by time and independent of payment;
 * collection applies cash to the oldest accrued period. Every posting has a deterministic id, so each call can be retried.
 *
 * <p>Finance leases can be terminated early (the customer pays the net investment still carried plus a fee) and the
 * lessee can buy the asset at the end (the difference to the residual carried is a disposal gain or loss). Payments in
 * advance, VAT on rentals, termination of operating leases and residual impairment are not handled yet.
 */
public final class LeaseService {
    public static final AccountId SUPPLIER_PAYABLE = new AccountId("gl:supplier-payable");
    public static final AccountId FINANCE_INCOME = new AccountId("gl:finance-income");
    public static final AccountId RENTAL_INCOME = new AccountId("gl:rental-income");
    public static final AccountId LEASED_ASSETS = new AccountId("gl:leased-assets");
    public static final AccountId DEPRECIATION_EXPENSE = new AccountId("gl:depreciation-expense");
    public static final AccountId ACCUMULATED_DEPRECIATION = new AccountId("gl:accumulated-depreciation");
    public static final AccountId TERMINATION_FEE_INCOME = new AccountId("gl:lease-termination-fee");
    /** Credit balance: gain on selling the asset to the lessee for more than the residual carried; debit: loss. */
    public static final AccountId DISPOSAL_GAIN = new AccountId("gl:lease-disposal-gain");

    private final TenantId tenant;
    private final LedgerService ledger;
    private final LeaseRepo repo;
    private final BusinessCalendar calendar;

    public LeaseService(TenantId tenant, LedgerService ledger, LeaseRepo repo, BusinessCalendar calendar) {
        this.tenant = tenant;
        this.ledger = ledger;
        this.repo = repo;
        this.calendar = calendar;
    }

    /** Net investment in a finance lease (asset: debit balance). */
    public static AccountId netInvestment(String id) {
        return new AccountId("lease:" + id + ":net-investment");
    }

    /** Rent billed on an operating lease and not yet collected (asset: debit balance). */
    public static AccountId rentReceivable(String id) {
        return new AccountId("lease:" + id + ":rent-receivable");
    }

    /**
     * Straight-line rent recognised less rent billed, cumulative, on an operating lease: a debit balance is accrued rent
     * (asset), a credit balance is deferred rent (billed ahead of recognition). One signed account keeps the two netted.
     */
    public static AccountId accruedRent(String id) {
        return new AccountId("lease:" + id + ":accrued-rent");
    }

    /**
     * Books a finance lease with payments in arrears. The implicit rate comes from the payment, residual and fair value;
     * the net investment starts at fair value plus initial direct costs.
     */
    public Lease bookFinance(String id, String party, String depositAccountId, Money fairValue, Money directCosts,
                             Money payment, int periods, Money residual, LocalDate start, Frequency frequency) {
        requireNew(id);
        FinanceLease.Result r = FinanceLease.fromPayment(fairValue, directCosts, payment, periods, residual,
                FinanceLease.Timing.ARREARS, frequency.perYear());
        List<Lease.Period> list = new ArrayList<>();
        for (FinanceLease.Row row : r.rows()) {
            list.add(new Lease.Period(row.period(), due(start, frequency, row.period()), row.payment().minor(),
                    row.income().minor(), 0, 0, false, 0));
        }
        post(id, "book", start, List.of(
                new Entry(netInvestment(id), BalanceType.SETTLED, Direction.DEBIT, r.initialNetInvestment()),
                new Entry(SUPPLIER_PAYABLE, BalanceType.SETTLED, Direction.CREDIT, r.initialNetInvestment())));
        Lease lease = new Lease(id, party, Lease.Kind.FINANCE, fairValue.currency().code(), depositAccountId, start,
                fairValue.minor(), residual.minor(), List.copyOf(list), Lease.Status.ACTIVE);
        repo.save(lease);
        return lease;
    }

    /** Books an operating lease; {@code rents} is the rent billed in each period (may be stepped or have free periods). */
    public Lease bookOperating(String id, String party, String depositAccountId, Money assetCost, Money residual,
                               List<Money> rents, LocalDate start, Frequency frequency) {
        requireNew(id);
        OperatingLease.Result r = OperatingLease.schedule(assetCost, residual, rents);
        List<Lease.Period> list = new ArrayList<>();
        for (OperatingLease.Row row : r.rows()) {
            list.add(new Lease.Period(row.period(), due(start, frequency, row.period()), row.billedRent().minor(), 0,
                    row.recognisedRent().minor(), row.depreciation().minor(), false, 0));
        }
        post(id, "book", start, List.of(
                new Entry(LEASED_ASSETS, BalanceType.SETTLED, Direction.DEBIT, assetCost),
                new Entry(SUPPLIER_PAYABLE, BalanceType.SETTLED, Direction.CREDIT, assetCost)));
        Lease lease = new Lease(id, party, Lease.Kind.OPERATING, assetCost.currency().code(), depositAccountId, start,
                assetCost.minor(), residual.minor(), List.copyOf(list), Lease.Status.ACTIVE);
        repo.save(lease);
        return lease;
    }

    /** Accrues period {@code number} once its due date has come: finance income, or rent billed, recognised and depreciation. */
    public Lease accrue(String id, int number, LocalDate asOf) {
        Lease lease = load(id);
        Lease.Period p = lease.periods().get(number - 1);
        if (p.accrued()) {
            return lease;
        }
        if (asOf.isBefore(p.dueDate())) {
            throw new IllegalArgumentException("Period " + number + " is not due until " + p.dueDate());
        }
        if (number > 1 && !lease.periods().get(number - 2).accrued()) {
            throw new IllegalStateException("Accrue periods in order");
        }
        Currency cur = Currency.of(lease.currency());
        List<Entry> entries = new ArrayList<>();
        if (lease.kind() == Lease.Kind.FINANCE) {
            add(entries, netInvestment(id), FINANCE_INCOME, p.income(), cur);
        } else {
            add(entries, rentReceivable(id), RENTAL_INCOME, p.payment(), cur);
            long diff = p.rentRecognised() - p.payment();
            if (diff > 0) {
                add(entries, accruedRent(id), RENTAL_INCOME, diff, cur);
            } else {
                add(entries, RENTAL_INCOME, accruedRent(id), -diff, cur);
            }
            add(entries, DEPRECIATION_EXPENSE, ACCUMULATED_DEPRECIATION, p.depreciation(), cur);
        }
        if (!entries.isEmpty()) {
            post(id, "accrue-" + number, p.dueDate(), entries);
        }
        List<Lease.Period> list = new ArrayList<>(lease.periods());
        list.set(number - 1, new Lease.Period(p.number(), p.dueDate(), p.payment(), p.income(), p.rentRecognised(),
                p.depreciation(), true, p.paid()));
        return keep(lease.withPeriods(List.copyOf(list), lease.status()));
    }

    /**
     * Applies a customer payment from their deposit account to the oldest accrued, unpaid periods. Paying more than is
     * owed is refused. Idempotent per reference. The lease completes when its last period has been collected.
     */
    public Lease collect(String id, String reference, Money amount, LocalDate date) {
        Lease lease = load(id);
        if (ledger.find(tenant, new BatchId(id + ":collect-" + reference)).isPresent()) {
            return lease;
        }
        if (amount.minor() <= 0) {
            throw new IllegalArgumentException("Payment must be positive");
        }
        long left = amount.minor();
        List<Lease.Period> list = new ArrayList<>(lease.periods());
        for (int k = 0; k < list.size() && left > 0; k++) {
            Lease.Period p = list.get(k);
            long part = Math.min(left, p.outstanding());
            if (part > 0) {
                list.set(k, new Lease.Period(p.number(), p.dueDate(), p.payment(), p.income(), p.rentRecognised(),
                        p.depreciation(), true, p.paid() + part));
                left -= part;
            }
        }
        if (left > 0) {
            throw new IllegalArgumentException("Payment exceeds what is due by " + left);
        }
        AccountId credit = lease.kind() == Lease.Kind.FINANCE ? netInvestment(id) : rentReceivable(id);
        post(id, "collect-" + reference, date, List.of(
                Entry.guardedDebit(new AccountId("dep:" + lease.depositAccountId()), BalanceType.SETTLED, amount),
                new Entry(credit, BalanceType.SETTLED, Direction.CREDIT, amount)));
        boolean done = list.stream().allMatch(p -> p.accrued() && p.outstanding() == 0);
        return keep(lease.withPeriods(List.copyOf(list), done ? Lease.Status.COMPLETED : lease.status()));
    }

    /** Net investment a finance lease still carries on {@code date}, accrued income included and collections taken off. */
    public Money carrying(String id, LocalDate date) {
        Lease lease = load(id);
        if (lease.kind() != Lease.Kind.FINANCE) {
            throw new IllegalArgumentException("Only a finance lease carries a net investment");
        }
        Currency cur = Currency.of(lease.currency());
        return Money.ofMinor(-ledger.balance(tenant, netInvestment(id), BalanceType.SETTLED, cur, date).minor(), cur);
    }

    /**
     * Early termination of a finance lease: the customer pays what the lease still carries (the remaining rentals at the
     * implicit rate plus the residual, and any accrued unpaid rent) plus {@code fee}. The unaccrued periods are cancelled.
     * Every period due by {@code date} must have been accrued first. Idempotent per reference.
     */
    public Lease terminate(String id, String reference, Money fee, LocalDate date) {
        Lease lease = load(id);
        if (ledger.find(tenant, new BatchId(id + ":terminate-" + reference)).isPresent()) {
            return lease;
        }
        if (lease.kind() != Lease.Kind.FINANCE || lease.status() != Lease.Status.ACTIVE) {
            throw new IllegalStateException("Only an active finance lease can be terminated");
        }
        if (fee.minor() < 0) {
            throw new IllegalArgumentException("Termination fee must not be negative");
        }
        for (Lease.Period p : lease.periods()) {
            if (!p.accrued() && !p.dueDate().isAfter(date)) {
                throw new IllegalStateException("Accrue period " + p.number() + " before terminating");
            }
        }
        Money carried = carrying(id, date);
        if (carried.minor() <= 0) {
            throw new IllegalStateException("Nothing is carried on lease " + id);
        }
        List<Entry> entries = new ArrayList<>();
        entries.add(Entry.guardedDebit(new AccountId("dep:" + lease.depositAccountId()), BalanceType.SETTLED, carried.plus(fee)));
        entries.add(new Entry(netInvestment(id), BalanceType.SETTLED, Direction.CREDIT, carried));
        if (fee.minor() > 0) {
            entries.add(new Entry(TERMINATION_FEE_INCOME, BalanceType.SETTLED, Direction.CREDIT, fee));
        }
        post(id, "terminate-" + reference, date, entries);
        List<Lease.Period> list = new ArrayList<>();
        for (Lease.Period p : lease.periods()) {
            list.add(p.accrued() ? new Lease.Period(p.number(), p.dueDate(), p.payment(), p.income(), p.rentRecognised(),
                    p.depreciation(), true, p.payment()) : p);
        }
        return keep(lease.withPeriods(List.copyOf(list), Lease.Status.TERMINATED));
    }

    /**
     * The lessee buys the asset when the lease has run off and been paid. The price is received from the customer's
     * deposit account, the residual still carried is released and the difference is a disposal gain or loss.
     * Idempotent per reference.
     */
    public Lease purchase(String id, String reference, Money price, LocalDate date) {
        Lease lease = load(id);
        if (ledger.find(tenant, new BatchId(id + ":purchase-" + reference)).isPresent()) {
            return lease;
        }
        if (lease.kind() != Lease.Kind.FINANCE || lease.status() != Lease.Status.COMPLETED) {
            throw new IllegalStateException("A purchase option needs a finance lease that has run off and been paid");
        }
        if (price.minor() <= 0) {
            throw new IllegalArgumentException("Purchase price must be positive");
        }
        Money carried = carrying(id, date);
        List<Entry> entries = new ArrayList<>();
        entries.add(Entry.guardedDebit(new AccountId("dep:" + lease.depositAccountId()), BalanceType.SETTLED, price));
        if (carried.minor() > 0) {
            entries.add(new Entry(netInvestment(id), BalanceType.SETTLED, Direction.CREDIT, carried));
        }
        long gain = price.minor() - carried.minor();
        if (gain > 0) {
            entries.add(new Entry(DISPOSAL_GAIN, BalanceType.SETTLED, Direction.CREDIT, Money.ofMinor(gain, price.currency())));
        } else if (gain < 0) {
            entries.add(new Entry(DISPOSAL_GAIN, BalanceType.SETTLED, Direction.DEBIT, Money.ofMinor(-gain, price.currency())));
        }
        post(id, "purchase-" + reference, date, entries);
        return keep(lease.withPeriods(lease.periods(), Lease.Status.PURCHASED));
    }

    /** What the customer owes now: accrued periods not yet collected. */
    public Money due(String id) {
        Lease lease = load(id);
        return Money.ofMinor(lease.periods().stream().mapToLong(Lease.Period::outstanding).sum(), Currency.of(lease.currency()));
    }

    public java.util.Optional<Lease> find(String id) {
        return repo.find(id);
    }

    private void add(List<Entry> entries, AccountId debit, AccountId credit, long amount, Currency cur) {
        if (amount > 0) {
            entries.add(new Entry(debit, BalanceType.SETTLED, Direction.DEBIT, Money.ofMinor(amount, cur)));
            entries.add(new Entry(credit, BalanceType.SETTLED, Direction.CREDIT, Money.ofMinor(amount, cur)));
        }
    }

    private LocalDate due(LocalDate start, Frequency f, int number) {
        return calendar.adjust(f.nth(start, number), Convention.FOLLOWING);
    }

    private void requireNew(String id) {
        if (repo.find(id).isPresent()) {
            throw new IllegalStateException("Lease already exists: " + id);
        }
    }

    private Lease load(String id) {
        return repo.find(id).orElseThrow(() -> new IllegalArgumentException("Unknown lease " + id));
    }

    private Lease keep(Lease lease) {
        repo.save(lease);
        return lease;
    }

    private void post(String id, String ref, LocalDate date, List<Entry> entries) {
        ledger.post(PostingBatch.of(tenant, new BatchId(id + ":" + ref), new IdempotencyKey(id + ":" + ref), date, entries));
    }
}
