package org.fabor.lending;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.BiFunction;
import org.fabor.engine.product.Cel;
import org.fabor.engine.product.ProductDefinition;
import org.fabor.engine.product.ProductQuote;
import org.fabor.engine.product.ProductValidator;
import org.fabor.engine.schedule.Installment;
import org.fabor.engine.schedule.Frequency;
import org.fabor.engine.schedule.Method;
import org.fabor.engine.schedule.ScheduleEngine;
import org.fabor.engine.schedule.ScheduleRequest;
import org.fabor.engine.tax.TaxInvoice;
import org.fabor.engine.tax.Vat;
import org.fabor.platform.time.BusinessCalendar.Convention;
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

/**
 * Loan servicing on the ledger. Ledger accounts per loan: principal, interest receivable and penalty
 * receivable (assets: debit balances). Interest is billed on the due date; penalties accrue daily on overdue
 * amounts; at the product's non-accrual day count, new interest goes to suspense instead of income. Every
 * posting has a deterministic id and key, so every operation can be retried.
 */
public final class LoanService {
    public static final AccountId FEE_INCOME = new AccountId("gl:fee-income");
    public static final AccountId INTEREST_INCOME = new AccountId("gl:interest-income");
    public static final AccountId INTEREST_SUSPENSE = new AccountId("gl:interest-suspense");
    public static final AccountId PENALTY_INCOME = new AccountId("gl:penalty-income");
    public static final AccountId VAT_PAYABLE = new AccountId("gl:vat-payable");

    /** Where tax invoices for fees go (the e-Tax service). {@code sellerTaxId} identifies the lender on them. */
    public record Invoicing(String sellerTaxId, java.util.function.Consumer<TaxInvoice> sink) { }

    public enum PrepaymentMode { REDUCE_TERM, REDUCE_INSTALMENT }

    private final TenantId tenant;
    private final LedgerService ledger;
    private final LoanRepo repo;
    private final BiFunction<String, Integer, ProductDefinition> products;
    private final BusinessCalendar calendar;
    private final Invoicing invoicing;

    public LoanService(TenantId tenant, LedgerService ledger, LoanRepo repo,
                       BiFunction<String, Integer, ProductDefinition> products, BusinessCalendar calendar) {
        this(tenant, ledger, repo, products, calendar, null);
    }

    public LoanService(TenantId tenant, LedgerService ledger, LoanRepo repo,
                       BiFunction<String, Integer, ProductDefinition> products, BusinessCalendar calendar, Invoicing invoicing) {
        this.invoicing = invoicing;
        this.tenant = tenant;
        this.ledger = ledger;
        this.repo = repo;
        this.products = products;
        this.calendar = calendar;
    }

    public static AccountId principalAcct(String id) {
        return new AccountId("loan:" + id + ":principal");
    }

    public static AccountId interestAcct(String id) {
        return new AccountId("loan:" + id + ":interest");
    }

    public static AccountId penaltyAcct(String id) {
        return new AccountId("loan:" + id + ":penalty");
    }

    /** Opens the loan from a quote and pays the net amount (principal less upfront fees) to the customer's deposit account. */
    public Loan disburse(String id, String party, String productCode, int version, Money principal, int term,
                         LocalDate date, String depositAccountId) {
        if (repo.find(id).isPresent()) {
            throw new IllegalStateException("Loan already exists: " + id);
        }
        ProductDefinition p = product(productCode, version);
        var quote = ProductQuote.quote(p, principal, term, date, calendar);
        Money fees = quote.disbursementFees().values().stream().reduce(Money.zero(principal.currency()), Money::plus);
        Money feeVat = Money.zero(principal.currency());
        var vat = p.tax() == null ? null : p.tax().vat();
        if (!fees.isZero() && vat != null && vat.appliesTo() != null && vat.appliesTo().contains("FEES")) {
            feeVat = Vat.exclusive(fees, vat.rate()).vat();
        }
        List<Entry> entries = new ArrayList<>();
        entries.add(new Entry(principalAcct(id), BalanceType.SETTLED, Direction.DEBIT, principal));
        entries.add(new Entry(new AccountId("dep:" + depositAccountId), BalanceType.SETTLED, Direction.CREDIT,
                principal.minus(fees).minus(feeVat)));
        if (!fees.isZero()) {
            entries.add(new Entry(FEE_INCOME, BalanceType.SETTLED, Direction.CREDIT, fees));
        }
        if (!feeVat.isZero()) {
            entries.add(new Entry(VAT_PAYABLE, BalanceType.SETTLED, Direction.CREDIT, feeVat));
            if (invoicing != null) {
                invoicing.sink().accept(TaxInvoice.of("INV-" + id + "-FEE", date, invoicing.sellerTaxId(), party,
                        List.of(new TaxInvoice.Line("Loan origination fee " + id, fees, feeVat))));
            }
        }
        post(id, "disburse", date, entries);
        List<Loan.Instalment> list = new ArrayList<>();
        for (Installment i : quote.schedule().installments()) {
            list.add(new Loan.Instalment(i.number(), i.dueDate(), i.principal().minor(), i.interest().minor(), 0, 0, 0, 0, false));
        }
        Loan loan = new Loan(id, party, productCode, version, principal.currency().code(), depositAccountId, date,
                principal.minor(), List.copyOf(list), Loan.Status.ACTIVE);
        repo.save(loan);
        return loan;
    }

    /** Recognises the instalment's interest on its due date (income, or suspense once non-accrual). */
    public Loan bill(String loanId, int number, LocalDate asOf) {
        Loan loan = load(loanId);
        Loan.Instalment i = loan.instalments().get(number - 1);
        if (i.billed()) {
            return loan;
        }
        if (asOf.isBefore(i.dueDate())) {
            throw new IllegalArgumentException("Instalment " + number + " is not due until " + i.dueDate());
        }
        if (number > 1 && !loan.instalments().get(number - 2).billed()) {
            throw new IllegalStateException("Bill instalments in order");
        }
        AccountId income = loan.status() == Loan.Status.NON_ACCRUAL ? INTEREST_SUSPENSE : INTEREST_INCOME;
        if (i.interestDue() > 0) {
            post(loanId, "bill-" + number, i.dueDate(), List.of(
                    new Entry(interestAcct(loanId), BalanceType.SETTLED, Direction.DEBIT, money(loan, i.interestDue())),
                    new Entry(income, BalanceType.SETTLED, Direction.CREDIT, money(loan, i.interestDue()))));
        }
        return replace(loan, number, new Loan.Instalment(i.number(), i.dueDate(), i.principalDue(), i.interestDue(),
                i.principalPaid(), i.interestPaid(), i.penaltyAccrued(), i.penaltyPaid(), true), loan.status());
    }

    /** Accrues the day's late charge on every overdue instalment, then applies the non-accrual rule. Idempotent per day. */
    public Loan accrueDaily(String loanId, LocalDate day) {
        Loan loan = load(loanId);
        ProductDefinition p = product(loan.productCode(), loan.productVersion());
        List<Loan.Instalment> list = new ArrayList<>(loan.instalments());
        long totalPenalty = 0;
        for (int k = 0; k < list.size(); k++) {
            Loan.Instalment i = list.get(k);
            if (!i.billed() || i.settled() || !day.isAfter(i.dueDate())) {
                continue;
            }
            long overdue = i.principalOutstanding() + i.interestOutstanding();
            long perDay = dailyPenalty(p, overdue);
            if (perDay > 0 && !postedPenalty(loanId, i.number(), day)) {
                totalPenalty += perDay;
                list.set(k, new Loan.Instalment(i.number(), i.dueDate(), i.principalDue(), i.interestDue(), i.principalPaid(),
                        i.interestPaid(), i.penaltyAccrued() + perDay, i.penaltyPaid(), true));
                post(loanId, "pen-" + i.number() + "-" + day, day, List.of(
                        new Entry(penaltyAcct(loanId), BalanceType.SETTLED, Direction.DEBIT, money(loan, perDay)),
                        new Entry(PENALTY_INCOME, BalanceType.SETTLED, Direction.CREDIT, money(loan, perDay))));
            }
        }
        Loan next = loan.withInstalments(List.copyOf(list), loan.status());
        Loan.Status status = loan.status();
        var d = p.delinquency();
        if (status == Loan.Status.ACTIVE && d != null && d.nonAccrualAtDpd() != null && dpd(next, day) >= d.nonAccrualAtDpd()) {
            status = Loan.Status.NON_ACCRUAL;
        }
        next = next.withStatus(status);
        if (totalPenalty > 0 || status != loan.status()) {
            repo.save(next);
        }
        return next;
    }

    /** Days past due: age of the oldest unpaid billed instalment. */
    public int dpd(String loanId, LocalDate asOf) {
        return dpd(load(loanId), asOf);
    }

    private static int dpd(Loan loan, LocalDate asOf) {
        for (Loan.Instalment i : loan.instalments()) {
            if (i.billed() && !i.settled() && asOf.isAfter(i.dueDate())) {
                return (int) ChronoUnit.DAYS.between(i.dueDate(), asOf);
            }
        }
        return 0;
    }

    /** Applies a customer payment from their deposit account to what is currently due, in waterfall order. */
    public Loan repay(String loanId, String reference, Money amount, LocalDate date) {
        Loan loan = load(loanId);
        if (ledger.find(tenant, new BatchId(loanId + ":pay-" + reference)).isPresent()) {
            return loan; // this payment reference was already applied
        }
        ProductDefinition p = product(loan.productCode(), loan.productVersion());
        List<Waterfall.Component> order = p.repaymentWaterfall().stream().map(Waterfall.Component::fromName).toList();
        List<Waterfall.Due> dues = new ArrayList<>();
        for (Loan.Instalment i : loan.instalments()) {
            if (i.billed()) {
                dues.add(new Waterfall.Due(i.number(), Waterfall.Component.PENALTY, i.penaltyOutstanding()));
                dues.add(new Waterfall.Due(i.number(), Waterfall.Component.INTEREST, i.interestOutstanding()));
                dues.add(new Waterfall.Due(i.number(), Waterfall.Component.PRINCIPAL, i.principalOutstanding()));
            }
        }
        Waterfall.Result r = Waterfall.allocate(amount.minor(), dues, order);
        if (r.unallocated() > 0) {
            throw new IllegalArgumentException("Payment exceeds what is due by " + r.unallocated()
                    + "; use settle() for early settlement");
        }
        applyAllocation(loan, reference, date, r.allocations(), amount);
        return repo.find(loanId).orElseThrow();
    }

    /** Amount that closes the loan on {@code date}: unpaid billed items plus remaining principal, no future interest. */
    public Money settlementQuote(String loanId, LocalDate date) {
        Loan loan = load(loanId);
        long total = 0;
        for (Loan.Instalment i : loan.instalments()) {
            total += i.billed() ? i.outstanding() : i.principalOutstanding();
        }
        return money(loan, total);
    }

    public Loan settle(String loanId, String reference, LocalDate date) {
        Loan loan = load(loanId);
        Money quote = settlementQuote(loanId, date);
        List<Waterfall.Allocation> all = new ArrayList<>();
        for (Loan.Instalment i : loan.instalments()) {
            if (i.penaltyOutstanding() > 0 && i.billed()) {
                all.add(new Waterfall.Allocation(i.number(), Waterfall.Component.PENALTY, i.penaltyOutstanding()));
            }
            if (i.billed() && i.interestOutstanding() > 0) {
                all.add(new Waterfall.Allocation(i.number(), Waterfall.Component.INTEREST, i.interestOutstanding()));
            }
            if (i.principalOutstanding() > 0) {
                all.add(new Waterfall.Allocation(i.number(), Waterfall.Component.PRINCIPAL, i.principalOutstanding()));
            }
        }
        if (quote.isZero()) {
            return keep(loan.withStatus(Loan.Status.CLOSED));
        }
        applyAllocation(loan, "settle-" + reference, date, all, quote);
        Loan after = repo.find(loanId).orElseThrow();
        // unbilled future instalments are cancelled: nothing more will be billed
        return keep(after.withStatus(Loan.Status.CLOSED));
    }

    private void applyAllocation(Loan loan, String reference, LocalDate date, List<Waterfall.Allocation> allocations,
                                 Money total) {
        long principal = 0;
        long interest = 0;
        long penalty = 0;
        List<Loan.Instalment> list = new ArrayList<>(loan.instalments());
        for (Waterfall.Allocation a : allocations) {
            Loan.Instalment i = list.get(a.instalment() - 1);
            list.set(a.instalment() - 1, switch (a.component()) {
                case PRINCIPAL -> {
                    principal += a.amount();
                    yield new Loan.Instalment(i.number(), i.dueDate(), i.principalDue(), i.interestDue(),
                            i.principalPaid() + a.amount(), i.interestPaid(), i.penaltyAccrued(), i.penaltyPaid(), i.billed());
                }
                case INTEREST -> {
                    interest += a.amount();
                    yield new Loan.Instalment(i.number(), i.dueDate(), i.principalDue(), i.interestDue(), i.principalPaid(),
                            i.interestPaid() + a.amount(), i.penaltyAccrued(), i.penaltyPaid(), i.billed());
                }
                case PENALTY -> {
                    penalty += a.amount();
                    yield new Loan.Instalment(i.number(), i.dueDate(), i.principalDue(), i.interestDue(), i.principalPaid(),
                            i.interestPaid(), i.penaltyAccrued(), i.penaltyPaid() + a.amount(), i.billed());
                }
                default -> throw new IllegalStateException("Component not postable in v1: " + a.component());
            });
        }
        List<Entry> entries = new ArrayList<>();
        entries.add(Entry.guardedDebit(new AccountId("dep:" + loan.depositAccountId()), BalanceType.SETTLED, total));
        if (principal > 0) {
            entries.add(new Entry(principalAcct(loan.id()), BalanceType.SETTLED, Direction.CREDIT, money(loan, principal)));
        }
        if (interest > 0) {
            entries.add(new Entry(interestAcct(loan.id()), BalanceType.SETTLED, Direction.CREDIT, money(loan, interest)));
        }
        if (penalty > 0) {
            entries.add(new Entry(penaltyAcct(loan.id()), BalanceType.SETTLED, Direction.CREDIT, money(loan, penalty)));
        }
        post(loan.id(), "pay-" + reference, date, entries);
        boolean allPaid = list.stream().allMatch(i -> i.principalOutstanding() == 0 && i.penaltyOutstanding() == 0
                && i.interestOutstanding() == 0);
        Loan.Status status = allPaid ? Loan.Status.CLOSED : loan.status();
        repo.save(loan.withInstalments(List.copyOf(list), status));
    }

    private boolean postedPenalty(String loanId, int number, LocalDate day) {
        return ledger.find(tenant, new BatchId(loanId + ":pen-" + number + "-" + day)).isPresent();
    }

    private long dailyPenalty(ProductDefinition p, long overdue) {
        long total = 0;
        if (p.fees() != null) {
            for (var f : p.fees()) {
                if ("DAILY_WHILE_OVERDUE".equals(f.trigger())) {
                    total += Cel.compile(f.amount(), ProductValidator.FEE_VARIABLES).evaluate(Map.of(
                            "principal", 0L, "term", 0L, "overdue", overdue, "outstanding", 0L));
                }
            }
        }
        return total;
    }

    /**
     * Partial prepayment on an instalment due date: the amount reduces principal, then the unbilled instalments are
     * rebuilt on the new balance, either keeping the number of instalments (smaller payment) or keeping about the same
     * payment (shorter loan). Only fixed-rate annuity products; nothing may be overdue or due unpaid. Idempotent per reference.
     */
    public Loan prepay(String loanId, String reference, Money amount, LocalDate date, PrepaymentMode mode) {
        Loan loan = load(loanId);
        if (ledger.find(tenant, new BatchId(loanId + ":prepay-" + reference)).isPresent()) {
            return loan;
        }
        ProductDefinition p = product(loan.productCode(), loan.productVersion());
        requireAnnuity(p);
        int first = firstUnbilled(loan);
        requireNothingDue(loan, first);
        Loan.Instalment head = loan.instalments().get(first);
        if (date.isBefore(first == 0 ? loan.disbursedOn() : loan.instalments().get(first - 1).dueDate()) || !date.isBefore(head.dueDate())) {
            throw new IllegalArgumentException("Prepayment must fall between the last billed due date and the next one");
        }
        if (amount.minor() <= 0) {
            throw new IllegalArgumentException("Prepayment must be positive");
        }
        long outstanding = loan.instalments().stream().skip(first).mapToLong(Loan.Instalment::principalOutstanding).sum();
        if (amount.minor() >= outstanding) {
            throw new IllegalArgumentException("Prepayment would clear the loan; use settle()");
        }
        long newBalance = outstanding - amount.minor();
        long level = head.principalDue() + head.interestDue();
        int remaining = loan.instalments().size() - first;
        int n = remaining;
        if (mode == PrepaymentMode.REDUCE_TERM) {
            n = 1;
            while (n < remaining && rebuild(p, loan, newBalance, n, date).get(0).total().minor() > level) {
                n++;
            }
        }
        List<Installment> fresh = rebuild(p, loan, newBalance, n, date);
        List<Loan.Instalment> list = new ArrayList<>(loan.instalments().subList(0, first));
        for (int i = 0; i < n; i++) {
            list.add(new Loan.Instalment(first + i + 1, loan.instalments().get(first + i).dueDate(), fresh.get(i).principal().minor(),
                    fresh.get(i).interest().minor(), 0, 0, 0, 0, false));
        }
        post(loanId, "prepay-" + reference, date, List.of(
                Entry.guardedDebit(new AccountId("dep:" + loan.depositAccountId()), BalanceType.SETTLED, amount),
                new Entry(principalAcct(loanId), BalanceType.SETTLED, Direction.CREDIT, amount)));
        return keep(loan.withInstalments(List.copyOf(list), loan.status()));
    }

    /**
     * Payment holiday: the next {@code periods} instalments are skipped, interest for the holiday is capitalised into the
     * principal (posted as income, or suspense if the loan is non-accrual) and the remaining instalments are rebuilt and
     * moved later by the same number of periods. Idempotent per reference.
     */
    public Loan holiday(String loanId, String reference, int periods, LocalDate date) {
        Loan loan = load(loanId);
        if (ledger.find(tenant, new BatchId(loanId + ":holiday-" + reference)).isPresent()) {
            return loan;
        }
        if (periods < 1 || periods > 6) {
            throw new IllegalArgumentException("A payment holiday is 1 to 6 periods");
        }
        ProductDefinition p = product(loan.productCode(), loan.productVersion());
        requireAnnuity(p);
        int first = firstUnbilled(loan);
        requireNothingDue(loan, first);
        Frequency f = Frequency.valueOf(p.schedule().frequency());
        java.math.BigDecimal r = org.fabor.engine.interest.Rates.periodic(p.pricing().rate(), f.perYear());
        Money out = money(loan, loan.instalments().stream().skip(first).mapToLong(Loan.Instalment::principalOutstanding).sum());
        Money start = out;
        for (int i = 0; i < periods; i++) {
            out = out.plus(out.times(r, java.math.RoundingMode.HALF_UP));
        }
        Money capitalised = out.minus(start);
        int remaining = loan.instalments().size() - first;
        Convention conv = p.schedule().holidayRule() == null ? Convention.FOLLOWING : Convention.valueOf(p.schedule().holidayRule());
        List<Installment> fresh = rebuild(p, loan, out.minor(), remaining, date);
        List<Loan.Instalment> list = new ArrayList<>(loan.instalments().subList(0, first));
        for (int i = 0; i < remaining; i++) {
            LocalDate moved = calendar.adjust(f.nth(loan.instalments().get(first + i).dueDate(), periods), conv);
            list.add(new Loan.Instalment(first + i + 1, moved, fresh.get(i).principal().minor(), fresh.get(i).interest().minor(),
                    0, 0, 0, 0, false));
        }
        if (!capitalised.isZero()) {
            AccountId income = loan.status() == Loan.Status.NON_ACCRUAL ? INTEREST_SUSPENSE : INTEREST_INCOME;
            post(loanId, "holiday-" + reference, date, List.of(
                    new Entry(principalAcct(loanId), BalanceType.SETTLED, Direction.DEBIT, capitalised),
                    new Entry(income, BalanceType.SETTLED, Direction.CREDIT, capitalised)));
        } else {
            post(loanId, "holiday-" + reference, date, List.of(
                    new Entry(principalAcct(loanId), BalanceType.SETTLED, Direction.DEBIT, Money.ofMinor(1, out.currency())),
                    new Entry(principalAcct(loanId), BalanceType.SETTLED, Direction.CREDIT, Money.ofMinor(1, out.currency()))));
        }
        return keep(loan.withInstalments(List.copyOf(list), loan.status()));
    }

    private List<Installment> rebuild(ProductDefinition p, Loan loan, long principal, int periods, LocalDate from) {
        Convention conv = p.schedule().holidayRule() == null ? Convention.FOLLOWING : Convention.valueOf(p.schedule().holidayRule());
        return ScheduleEngine.build(new ScheduleRequest(money(loan, principal), p.pricing().rate(), periods,
                Frequency.valueOf(p.schedule().frequency()), from, null, Method.ANNUITY, null, 0, calendar, conv,
                java.math.RoundingMode.HALF_UP)).installments();
    }

    private static void requireAnnuity(ProductDefinition p) {
        if (p.pricing() == null || p.pricing().rate() == null || !"ANNUITY".equals(p.schedule().method())) {
            throw new IllegalArgumentException("Only fixed-rate annuity products support this change");
        }
    }

    private static int firstUnbilled(Loan loan) {
        int i = 0;
        while (i < loan.instalments().size() && loan.instalments().get(i).billed()) {
            i++;
        }
        if (i == loan.instalments().size()) {
            throw new IllegalStateException("No instalments remain");
        }
        return i;
    }

    private static void requireNothingDue(Loan loan, int firstUnbilled) {
        for (int i = 0; i < firstUnbilled; i++) {
            if (!loan.instalments().get(i).settled()) {
                throw new IllegalStateException("Instalment " + (i + 1) + " is unpaid; clear arrears first");
            }
        }
    }

    private Loan keep(Loan loan) {
        repo.save(loan);
        return loan;
    }

    private Loan replace(Loan loan, int number, Loan.Instalment updated, Loan.Status status) {
        List<Loan.Instalment> list = new ArrayList<>(loan.instalments());
        list.set(number - 1, updated);
        Loan next = loan.withInstalments(List.copyOf(list), status);
        repo.save(next);
        return next;
    }

    private void post(String loanId, String ref, LocalDate date, List<Entry> entries) {
        ledger.post(PostingBatch.of(tenant, new BatchId(loanId + ":" + ref), new IdempotencyKey(loanId + ":" + ref), date, entries));
    }

    private static Money money(Loan loan, long minor) {
        return Money.ofMinor(minor, Currency.of(loan.currency()));
    }

    private ProductDefinition product(String code, int version) {
        ProductDefinition p = products.apply(code, version);
        if (p == null) {
            throw new IllegalArgumentException("Unknown product " + code + " v" + version);
        }
        return p;
    }

    private Loan load(String id) {
        return repo.find(id).orElseThrow(() -> new IllegalArgumentException("No such loan " + id));
    }
}
