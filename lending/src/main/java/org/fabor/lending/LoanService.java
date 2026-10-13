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

    private final TenantId tenant;
    private final LedgerService ledger;
    private final LoanRepo repo;
    private final BiFunction<String, Integer, ProductDefinition> products;
    private final BusinessCalendar calendar;

    public LoanService(TenantId tenant, LedgerService ledger, LoanRepo repo,
                       BiFunction<String, Integer, ProductDefinition> products, BusinessCalendar calendar) {
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
        List<Entry> entries = new ArrayList<>();
        entries.add(new Entry(principalAcct(id), BalanceType.SETTLED, Direction.DEBIT, principal));
        entries.add(new Entry(new AccountId("dep:" + depositAccountId), BalanceType.SETTLED, Direction.CREDIT, principal.minus(fees)));
        if (!fees.isZero()) {
            entries.add(new Entry(FEE_INCOME, BalanceType.SETTLED, Direction.CREDIT, fees));
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
