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
 * <p>Payments in advance, VAT on rentals, early termination, purchase options and residual disposal are not handled yet.
 */
public final class LeaseService {
    public static final AccountId SUPPLIER_PAYABLE = new AccountId("gl:supplier-payable");
    public static final AccountId FINANCE_INCOME = new AccountId("gl:finance-income");
    public static final AccountId RENTAL_INCOME = new AccountId("gl:rental-income");
    public static final AccountId LEASED_ASSETS = new AccountId("gl:leased-assets");
    public static final AccountId DEPRECIATION_EXPENSE = new AccountId("gl:depreciation-expense");
    public static final AccountId ACCUMULATED_DEPRECIATION = new AccountId("gl:accumulated-depreciation");

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
