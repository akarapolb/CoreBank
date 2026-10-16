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
import org.fabor.engine.schedule.RebateRule;
import org.fabor.engine.schedule.Schedule;
import org.fabor.engine.schedule.ScheduleEngine;
import org.fabor.engine.schedule.ScheduleRequest;
import org.fabor.engine.tax.InstalmentVat;
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

    /** VAT added to instalment bills and not yet paid by the customer (asset: debit balance). */
    public static AccountId vatAcct(String id) {
        return new AccountId("loan:" + id + ":vat");
    }

    /** The taxable base of instalment VAT for the product, or null when it charges none. */
    private static InstalmentVat.Base instalmentVatBase(ProductDefinition p) {
        var vat = p.tax() == null ? null : p.tax().vat();
        if (vat == null) {
            return null;
        }
        if (vat.appliesTo().contains("INSTALMENT_TOTAL")) {
            return InstalmentVat.Base.TOTAL;
        }
        return vat.appliesTo().contains("INSTALMENT_INTEREST") ? InstalmentVat.Base.INTEREST : null;
    }

    /** Opens the loan from a quote and pays the net amount (principal less upfront fees) to the customer's deposit account. */
    public Loan disburse(String id, String party, String productCode, int version, Money principal, int term,
                         LocalDate date, String depositAccountId) {
        return open(id, party, productCode, version, null, principal, term, date, depositAccountId, null);
    }

    /**
     * Like {@link #disburse} with the product's rate replaced by {@code lockedRate}, for a rate agreed outside the product
     * (a fleet rate card). The loan keeps the rate, so later prepayments and holidays use it too. When
     * {@code payoutAccountId} is another account (the dealer's), it receives the whole principal; the customer's
     * {@code depositAccountId} then pays the fee and VAT and stays the account instalments are collected from.
     */
    public Loan disburseAtRate(String id, String party, String productCode, int version, java.math.BigDecimal lockedRate,
                               Money principal, int term, LocalDate date, String depositAccountId, String payoutAccountId) {
        return open(id, party, productCode, version, lockedRate, principal, term, date, depositAccountId, payoutAccountId);
    }

    private Loan open(String id, String party, String productCode, int version, java.math.BigDecimal lockedRate, Money principal,
                      int term, LocalDate date, String depositAccountId, String payoutAccountId) {
        if (repo.find(id).isPresent()) {
            throw new IllegalStateException("Loan already exists: " + id);
        }
        ProductDefinition pinned = product(productCode, version);
        ProductDefinition p = lockedRate == null ? pinned : pinned.withRate(lockedRate);
        var quote = ProductQuote.quote(p, principal, term, date, calendar);
        Money fees = quote.disbursementFees().values().stream().reduce(Money.zero(principal.currency()), Money::plus);
        Money feeVat = Money.zero(principal.currency());
        var vat = p.tax() == null ? null : p.tax().vat();
        if (!fees.isZero() && vat != null && vat.appliesTo() != null && vat.appliesTo().contains("FEES")) {
            feeVat = Vat.exclusive(fees, vat.rate()).vat();
        }
        List<Entry> entries = new ArrayList<>();
        entries.add(new Entry(principalAcct(id), BalanceType.SETTLED, Direction.DEBIT, principal));
        if (payoutAccountId == null || payoutAccountId.equals(depositAccountId)) {
            entries.add(new Entry(new AccountId("dep:" + depositAccountId), BalanceType.SETTLED, Direction.CREDIT,
                    principal.minus(fees).minus(feeVat)));
        } else {   // paid out to the dealer in full; the customer pays the fee
            entries.add(new Entry(new AccountId("dep:" + payoutAccountId), BalanceType.SETTLED, Direction.CREDIT, principal));
            if (!fees.plus(feeVat).isZero()) {
                entries.add(Entry.guardedDebit(new AccountId("dep:" + depositAccountId), BalanceType.SETTLED, fees.plus(feeVat)));
            }
        }
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
                principal.minor(), List.copyOf(list), Loan.Status.ACTIVE, lockedRate, 0);
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
        ProductDefinition p = product(loan.productCode(), loan.productVersion());
        InstalmentVat.Base vatBase = instalmentVatBase(p);
        Vat.Split vat = vatBase == null ? null : InstalmentVat.of(money(loan, i.principalDue()), money(loan, i.interestDue()),
                vatBase, p.tax().vat().rate());
        long vatMinor = vat == null ? 0 : vat.vat().minor();
        List<Entry> entries = new ArrayList<>();
        if (i.interestDue() > 0) {
            entries.add(new Entry(interestAcct(loanId), BalanceType.SETTLED, Direction.DEBIT, money(loan, i.interestDue())));
            entries.add(new Entry(income, BalanceType.SETTLED, Direction.CREDIT, money(loan, i.interestDue())));
        }
        if (vatMinor > 0) {
            entries.add(new Entry(vatAcct(loanId), BalanceType.SETTLED, Direction.DEBIT, money(loan, vatMinor)));
            entries.add(new Entry(VAT_PAYABLE, BalanceType.SETTLED, Direction.CREDIT, money(loan, vatMinor)));
        }
        if (!entries.isEmpty()) {
            post(loanId, loan.tag() + "bill-" + number, i.dueDate(), entries);
        }
        if (vatMinor > 0 && invoicing != null) {
            invoicing.sink().accept(InstalmentVat.invoice(loanId + (loan.generation() == 0 ? "" : "-g" + loan.generation()),
                    number, i.dueDate(), invoicing.sellerTaxId(), loan.party(), vat));
        }
        return replace(loan, number, i.withBilled(vatMinor), loan.status());
    }

    /** Accrues the day's late charge on every overdue instalment, then applies the non-accrual rule. Idempotent per day. */
    public Loan accrueDaily(String loanId, LocalDate day) {
        Loan loan = load(loanId);
        if (loan.status() == Loan.Status.CLOSED || loan.status() == Loan.Status.WRITTEN_OFF) {
            return loan;
        }
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
            if (perDay > 0 && !postedPenalty(loanId, loan.tag(), i.number(), day)) {
                totalPenalty += perDay;
                list.set(k, i.withPenalty(perDay));
                post(loanId, loan.tag() + "pen-" + i.number() + "-" + day, day, List.of(
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
                dues.add(new Waterfall.Due(i.number(), Waterfall.Component.VAT, i.vatOutstanding()));
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

    /** What was taken from the customer's deposit account under a payment reference of {@link #repay}; zero if none. */
    public Money amountPaidWith(String loanId, String reference) {
        Loan loan = load(loanId);
        Money zero = money(loan, 0);
        return ledger.find(tenant, new BatchId(loanId + ":pay-" + reference)).map(sb -> sb.batch().entries().stream()
                .filter(e -> e.direction() == Direction.DEBIT && e.account().value().startsWith("dep:"))
                .map(Entry::amount).reduce(zero, Money::plus)).orElse(zero);
    }

    /**
     * Amount that closes the loan on {@code date}: unpaid billed items plus remaining principal, plus the part of the
     * interest not yet due that the product's early-settlement rebate rule does not excuse. With the default (actuarial)
     * rule no future interest is charged.
     */
    public Money settlementQuote(String loanId, LocalDate date) {
        Loan loan = load(loanId);
        long chargeable = chargeableInterest(loan);
        long total = chargeable + settlementVat(loan, chargeable);
        for (Loan.Instalment i : loan.instalments()) {
            total += i.billed() ? i.outstanding() : i.principalOutstanding();
        }
        return money(loan, total);
    }

    /**
     * VAT on the interest charged at settlement, for products that charge VAT on instalment interest. A product with VAT
     * on the whole instalment has no settlement rule yet, so settling it while instalments remain unbilled is refused.
     */
    private long settlementVat(Loan loan, long chargeable) {
        ProductDefinition p = product(loan.productCode(), loan.productVersion());
        InstalmentVat.Base base = instalmentVatBase(p);
        if (base == null || loan.status() == Loan.Status.CLOSED || loan.status() == Loan.Status.WRITTEN_OFF) {
            return 0;
        }
        if (base == InstalmentVat.Base.TOTAL) {
            if (loan.instalments().stream().anyMatch(i -> !i.billed())) {
                throw new IllegalStateException("Early settlement needs a termination rule for products with VAT on the "
                        + "whole instalment");
            }
            return 0;
        }
        return chargeable == 0 ? 0 : Vat.exclusive(money(loan, chargeable), p.tax().vat().rate()).vat().minor();
    }

    /**
     * Interest of the instalments not yet billed that is still charged on early settlement: what remains after the
     * product's rebate rule. Zero for the actuarial rule (the schedule's own interest is simply not earned), for a
     * closed or written-off loan and for products without a rebate rule.
     */
    private long chargeableInterest(Loan loan) {
        if (loan.status() == Loan.Status.CLOSED || loan.status() == Loan.Status.WRITTEN_OFF) {
            return 0;
        }
        RebateRule rule = rebateRule(product(loan.productCode(), loan.productVersion()));
        if (rule == null || rule.kind() == RebateRule.Kind.ACTUARIAL) {
            return 0;
        }
        long unbilled = loan.instalments().stream().filter(i -> !i.billed()).mapToLong(Loan.Instalment::interestDue).sum();
        return unbilled - unbilledRebate(loan, rule);
    }

    /**
     * Closes the loan early. Pays what {@link #settlementQuote} says from the customer's deposit account in one ledger
     * batch: billed items and principal as before, and the interest the rebate rule still charges as income (or
     * suspense on a non-accrual loan), so the batch is atomic and a retry posts nothing twice.
     */
    public Loan settle(String loanId, String reference, LocalDate date) {
        Loan loan = load(loanId);
        long chargeable = chargeableInterest(loan);
        Money quote = settlementQuote(loanId, date);
        List<Waterfall.Allocation> all = new ArrayList<>();
        for (Loan.Instalment i : loan.instalments()) {
            if (i.penaltyOutstanding() > 0 && i.billed()) {
                all.add(new Waterfall.Allocation(i.number(), Waterfall.Component.PENALTY, i.penaltyOutstanding()));
            }
            if (i.billed() && i.interestOutstanding() > 0) {
                all.add(new Waterfall.Allocation(i.number(), Waterfall.Component.INTEREST, i.interestOutstanding()));
            }
            if (i.billed() && i.vatOutstanding() > 0) {
                all.add(new Waterfall.Allocation(i.number(), Waterfall.Component.VAT, i.vatOutstanding()));
            }
            if (i.principalOutstanding() > 0) {
                all.add(new Waterfall.Allocation(i.number(), Waterfall.Component.PRINCIPAL, i.principalOutstanding()));
            }
        }
        if (quote.isZero()) {
            return keep(loan.withStatus(Loan.Status.CLOSED));
        }
        AccountId income = loan.status() == Loan.Status.NON_ACCRUAL ? INTEREST_SUSPENSE : INTEREST_INCOME;
        long settleVat = settlementVat(loan, chargeable);
        applyAllocation(loan, "settle-" + reference, date, all, quote, chargeable, income, settleVat);
        if (settleVat > 0 && invoicing != null) {
            ProductDefinition p = product(loan.productCode(), loan.productVersion());
            invoicing.sink().accept(TaxInvoice.of("INV-" + loanId + "-SETTLE-" + reference, date, invoicing.sellerTaxId(),
                    loan.party(), List.of(new TaxInvoice.Line("Interest on early settlement of " + loanId,
                            money(loan, chargeable), money(loan, settleVat)))));
        }
        Loan after = repo.find(loanId).orElseThrow();
        // unbilled future instalments are cancelled: nothing more will be billed
        return keep(after.withStatus(Loan.Status.CLOSED));
    }

    private void applyAllocation(Loan loan, String reference, LocalDate date, List<Waterfall.Allocation> allocations,
                                 Money total) {
        applyAllocation(loan, reference, date, allocations, total, 0, null, 0);
    }

    private void applyAllocation(Loan loan, String reference, LocalDate date, List<Waterfall.Allocation> allocations,
                                 Money total, long unbilledInterest, AccountId unbilledIncome, long unbilledVat) {
        long principal = 0;
        long interest = 0;
        long penalty = 0;
        long vat = 0;
        List<Loan.Instalment> list = new ArrayList<>(loan.instalments());
        for (Waterfall.Allocation a : allocations) {
            Loan.Instalment i = list.get(a.instalment() - 1);
            list.set(a.instalment() - 1, switch (a.component()) {
                case PRINCIPAL -> {
                    principal += a.amount();
                    yield i.withPaid(a.amount(), 0, 0, 0);
                }
                case INTEREST -> {
                    interest += a.amount();
                    yield i.withPaid(0, a.amount(), 0, 0);
                }
                case PENALTY -> {
                    penalty += a.amount();
                    yield i.withPaid(0, 0, a.amount(), 0);
                }
                case VAT -> {
                    vat += a.amount();
                    yield i.withPaid(0, 0, 0, a.amount());
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
        if (vat > 0) {
            entries.add(new Entry(vatAcct(loan.id()), BalanceType.SETTLED, Direction.CREDIT, money(loan, vat)));
        }
        if (unbilledInterest > 0) {
            entries.add(new Entry(unbilledIncome, BalanceType.SETTLED, Direction.CREDIT, money(loan, unbilledInterest)));
        }
        if (unbilledVat > 0) {
            entries.add(new Entry(VAT_PAYABLE, BalanceType.SETTLED, Direction.CREDIT, money(loan, unbilledVat)));
        }
        post(loan.id(), "pay-" + reference, date, entries);
        boolean allPaid = list.stream().allMatch(i -> i.principalOutstanding() == 0 && i.penaltyOutstanding() == 0
                && i.interestOutstanding() == 0 && i.vatOutstanding() == 0);
        Loan.Status status = allPaid ? Loan.Status.CLOSED : loan.status();
        repo.save(loan.withInstalments(List.copyOf(list), status));
    }

    private boolean postedPenalty(String loanId, String tag, int number, LocalDate day) {
        return ledger.find(tenant, new BatchId(loanId + ":" + tag + "pen-" + number + "-" + day)).isPresent();
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
        requireAmortising(p);
        boolean flat = isFlat(p);
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
        long chargeable = flat ? prepaidChargeable(loan, p, first, amount.minor(), outstanding) : 0;
        List<Entry> entries = new ArrayList<>(List.of(
                Entry.guardedDebit(new AccountId("dep:" + loan.depositAccountId()), BalanceType.SETTLED, amount.plus(money(loan, chargeable))),
                new Entry(principalAcct(loanId), BalanceType.SETTLED, Direction.CREDIT, amount)));
        if (chargeable > 0) {
            AccountId income = loan.status() == Loan.Status.NON_ACCRUAL ? INTEREST_SUSPENSE : INTEREST_INCOME;
            entries.add(new Entry(income, BalanceType.SETTLED, Direction.CREDIT, money(loan, chargeable)));
        }
        post(loanId, "prepay-" + reference, date, entries);
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
        requireAmortising(p);
        int first = firstUnbilled(loan);
        requireNothingDue(loan, first);
        Frequency f = Frequency.valueOf(p.schedule().frequency());
        // a flat-rate loan has no nominal periodic rate: its implied rate is the one that repays the unbilled instalments
        java.math.BigDecimal r = isFlat(p) ? impliedPeriodic(loan, first)
                : org.fabor.engine.interest.Rates.periodic(rateOf(loan, p), f.perYear());
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

    private static java.math.BigDecimal rateOf(Loan loan, ProductDefinition p) {
        return loan.rateOverride() != null ? loan.rateOverride() : p.pricing().rate();
    }

    private List<Installment> rebuild(ProductDefinition p, Loan loan, long principal, int periods, LocalDate from) {
        Convention conv = p.schedule().holidayRule() == null ? Convention.FOLLOWING : Convention.valueOf(p.schedule().holidayRule());
        return ScheduleEngine.build(new ScheduleRequest(money(loan, principal), rateOf(loan, p), periods,
                Frequency.valueOf(p.schedule().frequency()), from, null, isFlat(p) ? Method.ANNUITY_FROM_FLAT : Method.ANNUITY,
                null, 0, calendar, conv, java.math.RoundingMode.HALF_UP)).installments();
    }

    private static boolean isFlat(ProductDefinition p) {
        return "ANNUITY_FROM_FLAT".equals(p.schedule().method());
    }

    private static void requireAnnuity(ProductDefinition p) {
        if (p.pricing() == null || p.pricing().rate() == null || !"ANNUITY".equals(p.schedule().method())) {
            throw new IllegalArgumentException("Only fixed-rate annuity products support this change");
        }
    }

    /** Prepayment and payment holidays: fixed-rate annuity or flat-rate products (a flat quote is rebuilt flat). */
    private static void requireAmortising(ProductDefinition p) {
        if (p.pricing() == null || p.pricing().rate() == null || !("ANNUITY".equals(p.schedule().method()) || isFlat(p))) {
            throw new IllegalArgumentException("Only fixed-rate annuity or flat-rate products support this change");
        }
    }

    /** Periodic rate implied by the unbilled instalments of a flat-rate loan, from its principal outstanding. */
    private static java.math.BigDecimal impliedPeriodic(Loan loan, int first) {
        long principal = loan.instalments().stream().skip(first).mapToLong(Loan.Instalment::principalOutstanding).sum();
        List<Long> pays = loan.instalments().stream().skip(first).map(i -> i.principalDue() + i.interestDue()).toList();
        return org.fabor.engine.interest.Eir.periodicRate(principal, pays);
    }

    /**
     * Flat-rate prepayment: the interest the prepaid principal carried on the unbilled schedule, less the same share of
     * the product's rebate rule. Without a rebate rule (or with ACTUARIAL) nothing is charged on the prepaid part.
     */
    private long prepaidChargeable(Loan loan, ProductDefinition p, int first, long prepaid, long outstanding) {
        RebateRule rule = rebateRule(p);
        if (rule == null || rule.kind() == RebateRule.Kind.ACTUARIAL) {
            return 0;
        }
        long unbilledInterest = loan.instalments().stream().skip(first).mapToLong(Loan.Instalment::interestDue).sum();
        return share(unbilledInterest, prepaid, outstanding) - share(unbilledRebate(loan, rule), prepaid, outstanding);
    }

    private static long share(long part, long prepaid, long outstanding) {
        return java.math.BigDecimal.valueOf(part).multiply(java.math.BigDecimal.valueOf(prepaid))
                .divide(java.math.BigDecimal.valueOf(outstanding), 0, java.math.RoundingMode.HALF_UP).longValueExact();
    }

    private static RebateRule rebateRule(ProductDefinition p) {
        if (p.earlySettlement() == null || p.earlySettlement().rebate() == null) {
            return null;
        }
        return RebateRule.parse(p.earlySettlement().rebate());
    }

    /** Interest the rule excuses on the unbilled instalments of the loan, over the whole original schedule. */
    private static long unbilledRebate(Loan loan, RebateRule rule) {
        Currency cur = Currency.of(loan.currency());
        List<Installment> rows = new ArrayList<>();
        long totalInterest = 0;
        int billed = 0;
        for (Loan.Instalment i : loan.instalments()) {
            Money principal = Money.ofMinor(i.principalDue(), cur);
            Money interest = Money.ofMinor(i.interestDue(), cur);
            rows.add(new Installment(i.number(), i.dueDate(), principal, interest, principal.plus(interest), Money.zero(cur)));
            totalInterest += i.interestDue();
            if (i.billed()) {
                billed++;
            }
        }
        Schedule schedule = new Schedule(rows, java.math.BigDecimal.ZERO, java.math.BigDecimal.ZERO,
                Money.ofMinor(totalInterest, cur), Money.zero(cur));
        return rule.rebate(schedule, billed).minor();
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

    public static final AccountId MODIFICATION_LOSS = new AccountId("gl:modification-loss");
    public static final AccountId PENALTY_WAIVED = new AccountId("gl:penalty-waived");
    public static final AccountId WRITE_OFF_EXPENSE = new AccountId("gl:write-off-expense");
    public static final AccountId RECOVERY_INCOME = new AccountId("gl:recovery-income");

    /** Memo account (off balance sheet) holding what a written-off loan still owes and may be recovered. */
    public static AccountId writtenOffMemo(String id) {
        return new AccountId("loan:" + id + ":written-off");
    }

    /**
     * Restructuring (troubled debt): arrears are cleared into a new schedule at new terms. Unpaid billed interest is
     * capitalised into principal, unpaid penalties are waived, and the loan is rebuilt over {@code newTerm} periods at
     * {@code newRate}. Under IFRS 9 a modification is measured against the original effective rate: the new cash flows
     * are discounted at the old periodic rate and any shortfall against the carrying amount is booked as a modification
     * loss (a gain is not recognised here: policy decides). Fixed-rate annuity products only. Idempotent per reference.
     *
     * @return the restructured loan; the modification loss posted is on the ledger under {@link #MODIFICATION_LOSS}
     */
    public Loan restructure(String loanId, String reference, java.math.BigDecimal newRate, int newTerm, LocalDate date) {
        Loan loan = load(loanId);
        if (ledger.find(tenant, new BatchId(loanId + ":restructure-" + reference)).isPresent()) {
            return loan;
        }
        if (loan.status() == Loan.Status.CLOSED || loan.status() == Loan.Status.WRITTEN_OFF) {
            throw new IllegalStateException("Loan is " + loan.status());
        }
        if (newTerm < 1 || newTerm > 120 || newRate.signum() < 0 || newRate.compareTo(java.math.BigDecimal.ONE) > 0) {
            throw new IllegalArgumentException("Invalid restructuring terms");
        }
        ProductDefinition p = product(loan.productCode(), loan.productVersion());
        requireAnnuity(p);
        if (newRate.compareTo(rateOf(loan, p)) > 0) {
            throw new IllegalArgumentException("A restructuring cannot raise the rate");
        }
        if (loan.instalments().stream().anyMatch(i -> i.vatOutstanding() > 0)) {
            throw new IllegalStateException("VAT on billed instalments is unpaid; collect it before restructuring");
        }
        long principal = 0;
        long unpaidInterest = 0;
        long unpaidPenalty = 0;
        for (Loan.Instalment i : loan.instalments()) {
            principal += i.principalOutstanding();
            unpaidInterest += i.billed() ? i.interestOutstanding() : 0;
            unpaidPenalty += i.billed() ? i.penaltyOutstanding() : 0;
        }
        long carrying = principal + unpaidInterest;                        // what the loan is worth before modification
        Frequency f = Frequency.valueOf(p.schedule().frequency());
        java.math.BigDecimal oldPeriodic = org.fabor.engine.interest.Rates.periodic(rateOf(loan, p), f.perYear());
        Loan target = loan.withRate(newRate);
        List<Installment> fresh = rebuild(p, target, carrying, newTerm, date);
        // present value of the new payments at the original effective rate
        java.math.BigDecimal pv = java.math.BigDecimal.ZERO;
        java.math.BigDecimal factor = java.math.BigDecimal.ONE;
        for (Installment i : fresh) {
            factor = factor.multiply(java.math.BigDecimal.ONE.add(oldPeriodic), org.fabor.engine.interest.Rates.MC);
            pv = pv.add(java.math.BigDecimal.valueOf(i.total().minor()).divide(factor, org.fabor.engine.interest.Rates.MC));
        }
        long pvMinor = pv.setScale(0, java.math.RoundingMode.HALF_UP).longValueExact();
        long loss = Math.max(0, carrying - pvMinor);

        List<Entry> entries = new ArrayList<>();
        if (unpaidInterest > 0) {   // interest receivable becomes principal of the new loan
            entries.add(new Entry(principalAcct(loanId), BalanceType.SETTLED, Direction.DEBIT, money(loan, unpaidInterest)));
            entries.add(new Entry(interestAcct(loanId), BalanceType.SETTLED, Direction.CREDIT, money(loan, unpaidInterest)));
        }
        if (unpaidPenalty > 0) {    // penalties are waived: receivable written back against income
            entries.add(new Entry(PENALTY_WAIVED, BalanceType.SETTLED, Direction.DEBIT, money(loan, unpaidPenalty)));
            entries.add(new Entry(penaltyAcct(loanId), BalanceType.SETTLED, Direction.CREDIT, money(loan, unpaidPenalty)));
        }
        if (loss > 0) {
            entries.add(new Entry(MODIFICATION_LOSS, BalanceType.SETTLED, Direction.DEBIT, money(loan, loss)));
            entries.add(new Entry(principalAcct(loanId), BalanceType.SETTLED, Direction.CREDIT, money(loan, loss)));
        }
        if (entries.isEmpty()) {   // nothing to book: a marker keeps the operation idempotent
            entries.add(new Entry(principalAcct(loanId), BalanceType.SETTLED, Direction.DEBIT, Money.ofMinor(1, Currency.of(loan.currency()))));
            entries.add(new Entry(principalAcct(loanId), BalanceType.SETTLED, Direction.CREDIT, Money.ofMinor(1, Currency.of(loan.currency()))));
        }
        post(loanId, "restructure-" + reference, date, entries);

        // the carrying amount after booking is carrying - loss; the new schedule is built on the full carrying and its
        // principal is reduced by the loss on the last instalments so the schedule and the ledger agree
        List<Loan.Instalment> list = new ArrayList<>();
        Frequency freq = f;
        LocalDate anchor = freq.nth(date, 1);
        for (int k = 0; k < fresh.size(); k++) {
            Installment i = fresh.get(k);
            list.add(new Loan.Instalment(k + 1, calendar.adjust(freq.nth(anchor, k), Convention.FOLLOWING), i.principal().minor(),
                    i.interest().minor(), 0, 0, 0, 0, false));
        }
        long left = loss;
        for (int k = list.size() - 1; k >= 0 && left > 0; k--) {
            Loan.Instalment i = list.get(k);
            long cut = Math.min(left, i.principalDue());
            list.set(k, new Loan.Instalment(i.number(), i.dueDate(), i.principalDue() - cut, i.interestDue(), 0, 0, 0, 0, false));
            left -= cut;
        }
        return keep(target.withInstalments(List.copyOf(list), Loan.Status.ACTIVE));
    }

    /**
     * Writes the loan off: every remaining balance leaves the loan accounts into expense, and the amount owed is kept
     * on a memo account so later recoveries can be tracked. Allowed once the loan has reached the product's write-off
     * days past due, or earlier with {@code override} (an approved exception). Idempotent per reference.
     */
    public Loan writeOff(String loanId, String reference, LocalDate date, boolean override) {
        Loan loan = load(loanId);
        if (ledger.find(tenant, new BatchId(loanId + ":writeoff-" + reference)).isPresent()) {
            return loan;
        }
        if (loan.status() == Loan.Status.CLOSED || loan.status() == Loan.Status.WRITTEN_OFF) {
            throw new IllegalStateException("Loan is " + loan.status());
        }
        ProductDefinition p = product(loan.productCode(), loan.productVersion());
        Integer threshold = p.delinquency() == null ? null : p.delinquency().writeOffAtDpd();
        if (!override && (threshold == null || dpd(loan, date) < threshold)) {
            throw new IllegalStateException("Write-off needs " + (threshold == null ? "an approved override" : threshold + " days past due"));
        }
        long principal = 0;
        long interest = 0;
        long penalty = 0;
        long vat = 0;
        List<Loan.Instalment> cleared = new ArrayList<>();
        for (Loan.Instalment i : loan.instalments()) {
            principal += i.principalOutstanding();
            interest += i.billed() ? i.interestOutstanding() : 0;
            penalty += i.billed() ? i.penaltyOutstanding() : 0;
            vat += i.vatOutstanding();
            cleared.add(new Loan.Instalment(i.number(), i.dueDate(), i.principalDue(), i.interestDue(), i.principalDue(),
                    i.billed() ? i.interestDue() : i.interestPaid(), i.penaltyAccrued(), i.penaltyAccrued(), true, i.vatDue(),
                    i.vatDue()));
        }
        long total = principal + interest + penalty + vat;
        List<Entry> entries = new ArrayList<>();
        entries.add(new Entry(WRITE_OFF_EXPENSE, BalanceType.SETTLED, Direction.DEBIT, money(loan, total)));
        if (principal > 0) {
            entries.add(new Entry(principalAcct(loanId), BalanceType.SETTLED, Direction.CREDIT, money(loan, principal)));
        }
        if (interest > 0) {
            entries.add(new Entry(interestAcct(loanId), BalanceType.SETTLED, Direction.CREDIT, money(loan, interest)));
        }
        if (penalty > 0) {
            entries.add(new Entry(penaltyAcct(loanId), BalanceType.SETTLED, Direction.CREDIT, money(loan, penalty)));
        }
        if (vat > 0) {   // VAT already invoiced stays payable to the tax authority: relief is a tax-team decision
            entries.add(new Entry(vatAcct(loanId), BalanceType.SETTLED, Direction.CREDIT, money(loan, vat)));
        }
        post(loanId, "writeoff-" + reference, date, entries);
        // memo: the borrower still owes it
        post(loanId, "writeoff-memo-" + reference, date, List.of(
                new Entry(writtenOffMemo(loanId), BalanceType.CONTINGENT, Direction.DEBIT, money(loan, total)),
                new Entry(new AccountId("gl:written-off-memo"), BalanceType.CONTINGENT, Direction.CREDIT, money(loan, total))));
        return keep(loan.withInstalments(List.copyOf(cleared), Loan.Status.WRITTEN_OFF));
    }

    /** Money recovered from a written-off borrower: income, and a reduction of the memo balance. Idempotent per reference. */
    public Money recover(String loanId, String reference, Money amount, LocalDate date) {
        Loan loan = load(loanId);
        if (loan.status() != Loan.Status.WRITTEN_OFF) {
            throw new IllegalStateException("Only written-off loans have recoveries");
        }
        Money memo = ledger.currentBalance(tenant, writtenOffMemo(loanId), BalanceType.CONTINGENT, Currency.of(loan.currency()));
        long owed = -memo.minor();                                   // debit balance: positive amount still owed
        if (ledger.find(tenant, new BatchId(loanId + ":recovery-" + reference)).isEmpty()) {
            if (amount.minor() > owed) {
                throw new IllegalArgumentException("Recovery exceeds what is still owed (" + owed + ")");
            }
            post(loanId, "recovery-" + reference, date, List.of(
                    Entry.guardedDebit(new AccountId("dep:" + loan.depositAccountId()), BalanceType.SETTLED, amount),
                    new Entry(RECOVERY_INCOME, BalanceType.SETTLED, Direction.CREDIT, amount)));
            post(loanId, "recovery-memo-" + reference, date, List.of(
                    new Entry(new AccountId("gl:written-off-memo"), BalanceType.CONTINGENT, Direction.DEBIT, amount),
                    new Entry(writtenOffMemo(loanId), BalanceType.CONTINGENT, Direction.CREDIT, amount)));
        }
        return Money.ofMinor(-ledger.currentBalance(tenant, writtenOffMemo(loanId), BalanceType.CONTINGENT, Currency.of(loan.currency())).minor(),
                Currency.of(loan.currency()));
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
