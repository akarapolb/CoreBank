package org.fabor.lending;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.constraints.IntRange;
import net.jqwik.api.constraints.LongRange;
import org.fabor.engine.product.ProductDefinition;
import org.fabor.engine.product.ProductLoader;
import org.fabor.ledger.application.InsufficientFundsException;
import org.fabor.ledger.application.LedgerService;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.testkit.InMemoryLedgerStore;
import org.fabor.lending.Waterfall.Component;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.TenantId;
import org.fabor.platform.time.BusinessCalendar;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LendingTest {
    static final TenantId T = new TenantId("bank-a");
    static final LocalDate D0 = LocalDate.of(2026, 1, 15);
    private LedgerService ledger;
    private LoanService svc;
    private ProductDefinition product;

    static String yaml() throws IOException {
        try (var in = LendingTest.class.getResourceAsStream("/personal-loan.yaml")) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    @BeforeEach
    void setUp() throws IOException {
        wire(yaml());
    }

    private void wire(String y) {
        product = ProductLoader.parse(y);
        ledger = new LedgerService(new InMemoryLedgerStore(), Clock.fixed(Instant.parse("2026-12-31T00:00:00Z"), ZoneOffset.UTC));
        svc = new LoanService(T, ledger, new LoanRepo.InMemory(), (c, v) -> c.equals(product.product()) && v == 1 ? product : null,
                BusinessCalendar.monToFri(Set.of()));
        // the customer has a funded deposit account
        ledger.post(fund("seed", 20_000_000));
    }

    private org.fabor.ledger.domain.PostingBatch fund(String ref, long minor) {
        return org.fabor.ledger.domain.PostingBatch.of(T, new org.fabor.ledger.domain.BatchId(ref),
                new org.fabor.platform.tenancy.IdempotencyKey(ref), D0.minusDays(30), List.of(
                        new org.fabor.ledger.domain.Entry(new AccountId("gl:cash"), BalanceType.SETTLED,
                                org.fabor.ledger.domain.Direction.DEBIT, Money.ofMinor(minor, Currency.THB)),
                        new org.fabor.ledger.domain.Entry(new AccountId("dep:D1"), BalanceType.SETTLED,
                                org.fabor.ledger.domain.Direction.CREDIT, Money.ofMinor(minor, Currency.THB))));
    }

    private long bal(AccountId a) {
        return ledger.balance(T, a, BalanceType.SETTLED, Currency.THB, LocalDate.of(2030, 1, 1)).minor();
    }

    private Loan open() {
        return svc.disburse("L1", "party-1", "PERSONAL_LOAN_STD", 1, Money.of(new BigDecimal("100000"), Currency.THB), 12, D0, "D1");
    }

    @Test
    void disbursementPaysNetOfFeeAndBooksPrincipal() {
        Loan l = open();
        assertThat(l.instalments()).hasSize(12);
        assertThat(bal(LoanService.principalAcct("L1"))).isEqualTo(-10_000_000);      // asset: debit balance
        assertThat(bal(new AccountId("dep:D1"))).isEqualTo(20_000_000 + 10_000_000 - 100_000 - 7_000);   // fee plus 7% VAT on the fee
        assertThat(bal(LoanService.FEE_INCOME)).isEqualTo(100_000);
        assertThatThrownBy(this::open).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> svc.disburse("L2", "p", "NOPE", 1, Money.of(BigDecimal.TEN, Currency.THB), 12, D0, "D1"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void billingRecognisesInterestOnTheDueDate() {
        open();
        LocalDate due1 = LocalDate.of(2026, 2, 16); // 15 Feb is a Sunday: following business day
        assertThatThrownBy(() -> svc.bill("L1", 1, due1.minusDays(1))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.bill("L1", 2, LocalDate.of(2026, 4, 1))).isInstanceOf(IllegalStateException.class);
        Loan l = svc.bill("L1", 1, due1);
        assertThat(l.instalments().get(0).billed()).isTrue();
        assertThat(bal(LoanService.interestAcct("L1"))).isEqualTo(-150_000);          // 100,000 x 1.5%
        assertThat(bal(LoanService.INTEREST_INCOME)).isEqualTo(150_000);
        svc.bill("L1", 1, due1); // retry: no double booking
        assertThat(bal(LoanService.INTEREST_INCOME)).isEqualTo(150_000);
    }

    @Test
    void repaymentFollowsWaterfallAndClosesTheLoan() {
        open();
        LocalDate d = LocalDate.of(2026, 2, 16);
        svc.bill("L1", 1, d);
        Loan l = svc.repay("L1", "p1", Money.ofMinor(916_800, Currency.THB), d);
        assertThat(l.instalments().get(0).settled()).isTrue();
        assertThat(l.instalments().get(0).interestPaid()).isEqualTo(150_000);
        assertThat(l.instalments().get(0).principalPaid()).isEqualTo(766_800);
        assertThat(bal(LoanService.interestAcct("L1"))).isZero();
        assertThat(bal(LoanService.principalAcct("L1"))).isEqualTo(-10_000_000 + 766_800);
        // retry with the same reference does not double pay
        svc.repay("L1", "p1", Money.ofMinor(916_800, Currency.THB), d);
        assertThat(bal(LoanService.principalAcct("L1"))).isEqualTo(-10_000_000 + 766_800);
        // paying more than is due is refused (early settlement has its own path)
        assertThatThrownBy(() -> svc.repay("L1", "p2", Money.ofMinor(1, Currency.THB), d)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void fullLifeLeavesLoanAccountsAtZeroAndStatusClosed() {
        Loan opened = open();
        Loan l = opened;
        for (Loan.Instalment i : opened.instalments()) {
            svc.bill("L1", i.number(), i.dueDate());
            l = svc.repay("L1", "m" + i.number(), Money.ofMinor(i.principalDue() + i.interestDue(), Currency.THB), i.dueDate());
        }
        assertThat(l.status()).isEqualTo(Loan.Status.CLOSED);
        assertThat(bal(LoanService.principalAcct("L1"))).isZero();
        assertThat(bal(LoanService.interestAcct("L1"))).isZero();
        assertThat(bal(LoanService.INTEREST_INCOME)).isEqualTo(1_001_599); // matches the schedule's total interest
        assertThat(svc.settlementQuote("L1", LocalDate.of(2027, 2, 1)).isZero()).isTrue();
    }

    @Test
    void latePenaltyAccruesDailyOnceAndIsPaidFirst() {
        open();
        LocalDate due = LocalDate.of(2026, 2, 16);
        svc.bill("L1", 1, due);
        svc.accrueDaily("L1", due); // not yet late
        assertThat(bal(LoanService.penaltyAcct("L1"))).isZero();
        Loan l = svc.accrueDaily("L1", due.plusDays(1));
        assertThat(l.instalments().get(0).penaltyAccrued()).isEqualTo(367); // 0.04% of 9,168.00 = 3.6672
        svc.accrueDaily("L1", due.plusDays(1)); // same day again: nothing new
        assertThat(bal(LoanService.penaltyAcct("L1"))).isEqualTo(-367);
        svc.accrueDaily("L1", due.plusDays(2));
        assertThat(svc.dpd("L1", due.plusDays(2))).isEqualTo(2);
        // a payment of the instalment alone no longer clears it: penalty (734) comes first in the waterfall
        Loan after = svc.repay("L1", "late", Money.ofMinor(916_800, Currency.THB), due.plusDays(2));
        var i1 = after.instalments().get(0);
        assertThat(i1.penaltyOutstanding()).isZero();
        assertThat(i1.interestOutstanding()).isZero();
        assertThat(i1.principalOutstanding()).isEqualTo(734); // the penalty took 734 of the payment
        assertThat(i1.settled()).isFalse();
        assertThat(bal(LoanService.PENALTY_INCOME)).isEqualTo(734);
    }

    @Test
    void ninetyDaysPastDueStopsIncomeRecognition() {
        open();
        LocalDate due1 = LocalDate.of(2026, 2, 16);
        svc.bill("L1", 1, due1);
        Loan l = svc.accrueDaily("L1", due1.plusDays(89));
        assertThat(l.status()).isEqualTo(Loan.Status.ACTIVE);
        l = svc.accrueDaily("L1", due1.plusDays(90));
        assertThat(l.status()).isEqualTo(Loan.Status.NON_ACCRUAL);
        // the next instalment's interest now goes to suspense, not income
        LocalDate due2 = l.instalments().get(1).dueDate();
        long incomeBefore = bal(LoanService.INTEREST_INCOME);
        svc.bill("L1", 2, due2);
        assertThat(bal(LoanService.INTEREST_INCOME)).isEqualTo(incomeBefore);
        assertThat(bal(LoanService.INTEREST_SUSPENSE)).isPositive();
    }

    @Test
    void earlySettlementClosesTheLoanAndStopsFutureInterest() {
        open();
        LocalDate d = LocalDate.of(2026, 2, 16);
        svc.bill("L1", 1, d);
        svc.repay("L1", "p1", Money.ofMinor(916_800, Currency.THB), d);
        Money quote = svc.settlementQuote("L1", d);
        assertThat(quote.minor()).isEqualTo(10_000_000 - 766_800); // remaining principal only
        Loan closed = svc.settle("L1", "s1", d);
        assertThat(closed.status()).isEqualTo(Loan.Status.CLOSED);
        assertThat(bal(LoanService.principalAcct("L1"))).isZero();
        assertThat(bal(LoanService.interestAcct("L1"))).isZero();
        // total interest recognised is only what was billed
        assertThat(bal(LoanService.INTEREST_INCOME)).isEqualTo(150_000);
        // settling again is a no-op
        assertThat(svc.settle("L1", "s2", d).status()).isEqualTo(Loan.Status.CLOSED);
    }

    @Test
    void repaymentFromAnEmptyDepositAccountIsRefused() throws IOException {
        wire(yaml());
        svc = new LoanService(T, ledger, new LoanRepo.InMemory(), (c, v) -> product, BusinessCalendar.monToFri(Set.of()));
        svc.disburse("L9", "p", "PERSONAL_LOAN_STD", 1, Money.of(new BigDecimal("10000"), Currency.THB), 6, D0, "EMPTY");
        LocalDate due = LocalDate.of(2026, 2, 16);
        long balance = bal(new AccountId("dep:EMPTY"));
        ledger.post(org.fabor.ledger.domain.PostingBatch.of(T, new org.fabor.ledger.domain.BatchId("drain"),
                new org.fabor.platform.tenancy.IdempotencyKey("drain"), D0, List.of(
                        new org.fabor.ledger.domain.Entry(new AccountId("dep:EMPTY"), BalanceType.SETTLED,
                                org.fabor.ledger.domain.Direction.DEBIT, Money.ofMinor(balance, Currency.THB)),
                        new org.fabor.ledger.domain.Entry(new AccountId("gl:cash"), BalanceType.SETTLED,
                                org.fabor.ledger.domain.Direction.CREDIT, Money.ofMinor(balance, Currency.THB)))));
        svc.bill("L9", 1, due);
        assertThatThrownBy(() -> svc.repay("L9", "x", Money.ofMinor(100, Currency.THB), due))
                .isInstanceOf(InsufficientFundsException.class);
        assertThatThrownBy(() -> svc.dpd("none", D0)).isInstanceOf(IllegalArgumentException.class);
    }

    // ---- waterfall
    @Test
    void waterfallOrdersByInstalmentThenComponent() {
        List<Component> order = List.of(Component.FEES, Component.PENALTY, Component.VAT, Component.INTEREST, Component.PRINCIPAL);
        List<Waterfall.Due> dues = List.of(
                new Waterfall.Due(2, Component.PRINCIPAL, 500), new Waterfall.Due(1, Component.PRINCIPAL, 300),
                new Waterfall.Due(1, Component.INTEREST, 100), new Waterfall.Due(1, Component.PENALTY, 20),
                new Waterfall.Due(2, Component.INTEREST, 50), new Waterfall.Due(3, Component.FEES, 0));
        Waterfall.Result r = Waterfall.allocate(450, dues, order);
        assertThat(r.allocations()).extracting(a -> a.instalment() + ":" + a.component() + ":" + a.amount())
                .containsExactly("1:PENALTY:20", "1:INTEREST:100", "1:PRINCIPAL:300", "2:INTEREST:30");
        assertThat(r.unallocated()).isZero();
        assertThat(r.total(Component.PRINCIPAL)).isEqualTo(300);
        assertThat(Waterfall.allocate(10_000, dues, order).unallocated()).isEqualTo(10_000 - 970);
        assertThat(Waterfall.allocate(0, dues, order).allocations()).isEmpty();
        // a component missing from the product's order is never paid
        assertThat(Waterfall.allocate(1000, dues, List.of(Component.PRINCIPAL)).total(Component.INTEREST)).isZero();
        assertThatThrownBy(() -> Waterfall.allocate(-1, dues, order)).isInstanceOf(IllegalArgumentException.class);
        assertThat(Component.fromName("VAT_DUE")).isEqualTo(Component.VAT);
        assertThat(Component.fromName("FEES_DUE")).isEqualTo(Component.FEES);
        assertThatThrownBy(() -> Component.fromName("MAGIC")).isInstanceOf(IllegalArgumentException.class);
    }

    @Property
    void waterfallNeverOverAllocates(@ForAll @LongRange(min = 0, max = 100_000) long payment,
                                     @ForAll @IntRange(min = 0, max = 5000) int a, @ForAll @IntRange(min = 0, max = 5000) int b,
                                     @ForAll @IntRange(min = 0, max = 5000) int c) {
        List<Waterfall.Due> dues = List.of(new Waterfall.Due(1, Component.INTEREST, a), new Waterfall.Due(1, Component.PRINCIPAL, b),
                new Waterfall.Due(2, Component.PRINCIPAL, c));
        Waterfall.Result r = Waterfall.allocate(payment, dues, List.of(Component.INTEREST, Component.PRINCIPAL));
        long allocated = r.allocations().stream().mapToLong(Waterfall.Allocation::amount).sum();
        assertThat(allocated + r.unallocated()).isEqualTo(payment);
        assertThat(allocated).isLessThanOrEqualTo((long) a + b + c);
    }

    @Test
    void zeroRateProductWithoutFeesOrDelinquencyRules() throws IOException {
        String y = yaml().replace("rate: 0.18", "rate: 0").replaceAll("(?s)fees:.*?repayment_waterfall:", "repayment_waterfall:")
                .replaceAll("(?s)delinquency:.*?accounting:", "accounting:");
        wire(y);
        Loan l = svc.disburse("Z1", "p", "PERSONAL_LOAN_STD", 1, Money.of(new BigDecimal("12000"), Currency.THB), 6, D0, "D1");
        assertThat(bal(LoanService.FEE_INCOME)).isZero();
        assertThat(l.instalments().get(0).interestDue()).isZero();
        LocalDate due = l.instalments().get(0).dueDate();
        svc.bill("Z1", 1, due);
        assertThat(bal(LoanService.INTEREST_INCOME)).isZero();
        Loan late = svc.accrueDaily("Z1", due.plusDays(200));      // no penalty rule, no non-accrual rule
        assertThat(late.status()).isEqualTo(Loan.Status.ACTIVE);
        assertThat(late.instalments().get(0).penaltyAccrued()).isZero();
        // a paid instalment is skipped by accrual and has no days past due
        svc.repay("Z1", "p1", Money.ofMinor(l.instalments().get(0).principalDue(), Currency.THB), due.plusDays(200));
        assertThat(svc.dpd("Z1", due.plusDays(300))).isZero();
        assertThat(svc.accrueDaily("Z1", due.plusDays(300)).instalments().get(0).penaltyAccrued()).isZero();
    }

    @Test
    void settlementClearsPenaltyInterestAndPrincipalTogether() {
        open();
        LocalDate due = LocalDate.of(2026, 2, 16);
        svc.bill("L1", 1, due);
        svc.accrueDaily("L1", due.plusDays(1));
        svc.accrueDaily("L1", due.plusDays(2));
        assertThat(svc.settlementQuote("L1", due.plusDays(2)).minor()).isEqualTo(10_000_000 + 150_000 + 734);
        Loan closed = svc.settle("L1", "payoff", due.plusDays(2));
        assertThat(closed.status()).isEqualTo(Loan.Status.CLOSED);
        assertThat(bal(LoanService.penaltyAcct("L1"))).isZero();
        assertThat(bal(LoanService.interestAcct("L1"))).isZero();
        assertThat(bal(LoanService.principalAcct("L1"))).isZero();
    }

    // ---- Phase 1 gap closers: prepayment, payment holiday, VAT on fees

    private Loan billAndPay(Loan l, int number) {
        var i = l.instalments().get(number - 1);
        svc.bill("L1", number, i.dueDate());
        return svc.repay("L1", "m" + number, Money.ofMinor(i.principalDue() + i.interestDue(), Currency.THB), i.dueDate());
    }

    private long outstandingPrincipal(Loan l) {
        return l.instalments().stream().mapToLong(Loan.Instalment::principalOutstanding).sum();
    }

    @Test
    void partialPrepaymentReducingTheInstalment() {
        Loan l = billAndPay(open(), 1);
        LocalDate due1 = l.instalments().get(0).dueDate();
        long before = outstandingPrincipal(l);
        long oldPayment = l.instalments().get(1).principalDue() + l.instalments().get(1).interestDue();
        Loan after = svc.prepay("L1", "pp1", Money.ofMinor(2_000_000, Currency.THB), due1.plusDays(1), LoanService.PrepaymentMode.REDUCE_INSTALMENT);
        assertThat(after.instalments()).hasSize(12);                                            // same number of instalments
        assertThat(outstandingPrincipal(after)).isEqualTo(before - 2_000_000);
        long newPayment = after.instalments().get(1).principalDue() + after.instalments().get(1).interestDue();
        assertThat(newPayment).isLessThan(oldPayment);                                           // smaller payment
        assertThat(after.instalments().get(1).dueDate()).isEqualTo(l.instalments().get(1).dueDate());   // dates unchanged
        assertThat(bal(LoanService.principalAcct("L1"))).isEqualTo(-outstandingPrincipal(after));       // ledger agrees with the schedule
        // the same reference again does nothing
        assertThat(outstandingPrincipal(svc.prepay("L1", "pp1", Money.ofMinor(2_000_000, Currency.THB), due1.plusDays(1),
                LoanService.PrepaymentMode.REDUCE_INSTALMENT))).isEqualTo(outstandingPrincipal(after));
    }

    @Test
    void partialPrepaymentReducingTheTerm() {
        Loan l = billAndPay(open(), 1);
        LocalDate day = l.instalments().get(0).dueDate().plusDays(1);
        long oldPayment = l.instalments().get(1).principalDue() + l.instalments().get(1).interestDue();
        Loan after = svc.prepay("L1", "pp2", Money.ofMinor(3_000_000, Currency.THB), day, LoanService.PrepaymentMode.REDUCE_TERM);
        assertThat(after.instalments().size()).isLessThan(12);                                   // shorter loan
        long newPayment = after.instalments().get(1).principalDue() + after.instalments().get(1).interestDue();
        assertThat(newPayment).isLessThanOrEqualTo(oldPayment);
        assertThat(after.instalments().get(after.instalments().size() - 1).dueDate())
                .isEqualTo(l.instalments().get(after.instalments().size() - 1).dueDate());
        // it still runs to zero
        Loan cur = after;
        for (int i = 2; i <= cur.instalments().size(); i++) {
            var inst = cur.instalments().get(i - 1);
            svc.bill("L1", i, inst.dueDate());
            cur = svc.repay("L1", "m" + i, Money.ofMinor(inst.principalDue() + inst.interestDue(), Currency.THB), inst.dueDate());
        }
        assertThat(cur.status()).isEqualTo(Loan.Status.CLOSED);
        assertThat(bal(LoanService.principalAcct("L1"))).isZero();
    }

    @Test
    void prepaymentRules() {
        Loan l = open();
        Loan l2 = svc.bill("L1", 1, l.instalments().get(0).dueDate());
        // instalment 1 is billed but unpaid: arrears block a prepayment
        assertThatThrownBy(() -> svc.prepay("L1", "y", Money.ofMinor(1_000, Currency.THB), l2.instalments().get(0).dueDate().plusDays(1),
                LoanService.PrepaymentMode.REDUCE_TERM)).isInstanceOf(IllegalStateException.class);
        Loan paid = svc.repay("L1", "m1", Money.ofMinor(916_800, Currency.THB), l2.instalments().get(0).dueDate());
        LocalDate ok = paid.instalments().get(0).dueDate().plusDays(1);
        assertThatThrownBy(() -> svc.prepay("L1", "z", Money.ofMinor(0, Currency.THB), ok, LoanService.PrepaymentMode.REDUCE_TERM))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.prepay("L1", "z", Money.ofMinor(99_000_000, Currency.THB), ok, LoanService.PrepaymentMode.REDUCE_TERM))
                .hasMessageContaining("settle");
        assertThatThrownBy(() -> svc.prepay("L1", "z", Money.ofMinor(1_000, Currency.THB), paid.instalments().get(1).dueDate(),
                LoanService.PrepaymentMode.REDUCE_TERM)).hasMessageContaining("between");
    }

    @Test
    void paymentHolidayCapitalisesInterestAndMovesTheSchedule() {
        Loan l = billAndPay(open(), 1);
        long before = outstandingPrincipal(l);
        LocalDate day = l.instalments().get(0).dueDate().plusDays(1);
        Loan after = svc.holiday("L1", "h1", 2, day);
        assertThat(after.instalments()).hasSize(12);
        long capitalised = outstandingPrincipal(after) - before;
        assertThat(capitalised).isEqualTo(Math.round(before * 0.015) + Math.round((before + Math.round(before * 0.015)) * 0.015)
                + 0 * 1);                                                                       // two months of interest at 1.5%
        assertThat(after.instalments().get(1).dueDate()).isAfter(l.instalments().get(1).dueDate().plusDays(50));   // moved about two months
        assertThat(bal(LoanService.principalAcct("L1"))).isEqualTo(-outstandingPrincipal(after));
        assertThat(bal(LoanService.INTEREST_INCOME)).isEqualTo(150_000 + capitalised);
        assertThat(outstandingPrincipal(svc.holiday("L1", "h1", 2, day))).isEqualTo(outstandingPrincipal(after));   // retry safe
        assertThatThrownBy(() -> svc.holiday("L1", "h2", 0, day)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.holiday("L1", "h3", 7, day)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void holidayAndPrepaymentRefuseFlatRateProducts() throws IOException {
        String flat = yaml().replace("rate_type: FIXED", "rate_type: FLAT").replace("method: ANNUITY", "method: ANNUITY_FROM_FLAT")
                .replace("rate: 0.18", "rate: 0.05");
        wire(flat);
        Loan l = svc.disburse("L1", "p", "PERSONAL_LOAN_STD", 1, Money.of(new BigDecimal("100000"), Currency.THB), 12, D0, "D1");
        svc.bill("L1", 1, l.instalments().get(0).dueDate());
        svc.repay("L1", "m1", Money.ofMinor(l.instalments().get(0).principalDue() + l.instalments().get(0).interestDue(), Currency.THB),
                l.instalments().get(0).dueDate());
        LocalDate day = l.instalments().get(0).dueDate().plusDays(1);
        assertThatThrownBy(() -> svc.holiday("L1", "h", 1, day)).hasMessageContaining("annuity");
        assertThatThrownBy(() -> svc.prepay("L1", "p", Money.ofMinor(1_000, Currency.THB), day, LoanService.PrepaymentMode.REDUCE_TERM))
                .hasMessageContaining("annuity");
    }

    @Test
    void vatOnTheOriginationFeeIsCollectedAndInvoiced() throws IOException {
        List<org.fabor.engine.tax.TaxInvoice> invoices = new java.util.ArrayList<>();
        product = ProductLoader.parse(yaml());
        wire(yaml());
        svc = new LoanService(T, ledger, new LoanRepo.InMemory(), (c, v) -> product, BusinessCalendar.monToFri(Set.of()),
                new LoanService.Invoicing("0105500000001", invoices::add));
        // the sample product charges VAT on fees at 7%: fee 1,000.00 plus 70.00 VAT
        svc.disburse("L1", "party-1", "PERSONAL_LOAN_STD", 1, Money.of(new BigDecimal("100000"), Currency.THB), 12, D0, "D1");
        assertThat(bal(LoanService.FEE_INCOME)).isEqualTo(100_000);
        assertThat(bal(LoanService.VAT_PAYABLE)).isEqualTo(7_000);
        assertThat(bal(new AccountId("dep:D1"))).isEqualTo(20_000_000 + 10_000_000 - 100_000 - 7_000);
        assertThat(invoices).hasSize(1);
        assertThat(invoices.get(0).gross().minor()).isEqualTo(107_000);
        assertThat(invoices.get(0).number()).isEqualTo("INV-L1-FEE");
        // without invoicing configured the VAT is still collected
        wire(yaml());
        svc.disburse("L2", "party-1", "PERSONAL_LOAN_STD", 1, Money.of(new BigDecimal("100000"), Currency.THB), 12, D0, "D1");
        assertThat(bal(LoanService.VAT_PAYABLE)).isEqualTo(7_000);
    }

    @Test
    void zeroRateProductWithoutTaxOrHolidayRuleStillSupportsChanges() throws IOException {
        String y = yaml().replace("rate: 0.18", "rate: 0").replace("  holiday_rule: FOLLOWING\n", "")
                .replaceAll("(?s)tax:.*?early_settlement:", "early_settlement:");
        wire(y);
        Loan l = svc.disburse("L1", "p", "PERSONAL_LOAN_STD", 1, Money.of(new BigDecimal("12000"), Currency.THB), 6, D0, "D1");
        assertThat(bal(LoanService.VAT_PAYABLE)).isZero();                    // no tax block: no VAT
        // a prepayment before the first due date is allowed (nothing billed yet)
        Loan pre = svc.prepay("L1", "early", Money.ofMinor(100_000, Currency.THB), D0.plusDays(3), LoanService.PrepaymentMode.REDUCE_INSTALMENT);
        assertThat(outstandingPrincipal(pre)).isEqualTo(1_200_000 - 100_000);
        // a holiday on a zero-rate loan capitalises nothing but still moves the schedule, and retries stay safe
        Loan h = svc.holiday("L1", "h", 1, D0.plusDays(4));
        assertThat(outstandingPrincipal(h)).isEqualTo(1_100_000);
        assertThat(h.instalments().get(0).dueDate()).isAfter(l.instalments().get(0).dueDate());
        assertThat(svc.holiday("L1", "h", 1, D0.plusDays(4)).instalments().get(0).dueDate()).isEqualTo(h.instalments().get(0).dueDate());
    }

    @Test
    void holidayOnANonAccrualLoanCapitalisesIntoSuspense() {
        Loan l = open();
        LocalDate due1 = l.instalments().get(0).dueDate();
        svc.bill("L1", 1, due1);
        svc.accrueDaily("L1", due1.plusDays(90));                         // non-accrual now
        svc.repay("L1", "arrears", Money.ofMinor(916_800 + 367, Currency.THB), due1.plusDays(90));
        long suspenseBefore = bal(LoanService.INTEREST_SUSPENSE);
        Loan after = svc.holiday("L1", "h", 1, due1.plusDays(91));
        assertThat(after.status()).isEqualTo(Loan.Status.NON_ACCRUAL);
        assertThat(bal(LoanService.INTEREST_SUSPENSE)).isGreaterThan(suspenseBefore);
    }

    @Test
    void changesNeedInstalmentsLeft() {
        Loan l = open();
        Loan cur = l;
        for (int i = 1; i <= 12; i++) {
            var inst = cur.instalments().get(i - 1);
            svc.bill("L1", i, inst.dueDate());
            cur = svc.repay("L1", "m" + i, Money.ofMinor(inst.principalDue() + inst.interestDue(), Currency.THB), inst.dueDate());
        }
        LocalDate late = cur.instalments().get(11).dueDate().plusDays(1);
        assertThatThrownBy(() -> svc.holiday("L1", "h", 1, late)).isInstanceOf(IllegalStateException.class);
    }

    // ---- restructuring, write-off and recovery

    private Loan inArrears() {
        Loan l = open();
        LocalDate due1 = l.instalments().get(0).dueDate();
        svc.bill("L1", 1, due1);
        svc.accrueDaily("L1", due1.plusDays(1));
        svc.accrueDaily("L1", due1.plusDays(2));          // penalty 734
        return svc.accrueDaily("L1", due1.plusDays(2));
    }

    @Test
    void restructuringClearsArrearsAndBooksAModificationLoss() {
        Loan l = inArrears();
        LocalDate day = l.instalments().get(0).dueDate().plusDays(10);
        Loan r = svc.restructure("L1", "tdr1", new BigDecimal("0.09"), 18, day);
        assertThat(r.instalments()).hasSize(18);
        assertThat(r.status()).isEqualTo(Loan.Status.ACTIVE);
        assertThat(r.rateOverride()).isEqualByComparingTo("0.09");
        assertThat(r.instalments().stream().allMatch(i -> !i.billed() && i.principalPaid() == 0)).isTrue();
        // arrears are gone from the receivables: interest moved into principal, penalty waived
        assertThat(bal(LoanService.interestAcct("L1"))).isZero();
        assertThat(bal(LoanService.penaltyAcct("L1"))).isZero();
        assertThat(bal(LoanService.PENALTY_WAIVED)).isEqualTo(-734);
        // lower rate than the original effective rate: the PV of the new cash flows is below carrying, a loss is booked
        long loss = -bal(LoanService.MODIFICATION_LOSS);
        assertThat(loss).isPositive();
        // the ledger and the new schedule agree to the satang
        assertThat(bal(LoanService.principalAcct("L1"))).isEqualTo(-outstandingPrincipal(r));
        // retry changes nothing; a higher rate is refused
        assertThat(svc.restructure("L1", "tdr1", new BigDecimal("0.09"), 18, day).instalments()).hasSize(18);
        assertThat(-bal(LoanService.MODIFICATION_LOSS)).isEqualTo(loss);
        assertThatThrownBy(() -> svc.restructure("L1", "tdr2", new BigDecimal("0.30"), 18, day)).hasMessageContaining("raise");
        assertThatThrownBy(() -> svc.restructure("L1", "tdr3", new BigDecimal("0.09"), 0, day)).isInstanceOf(IllegalArgumentException.class);
        // the restructured loan runs to zero at the new rate
        Loan cur = r;
        for (int i = 1; i <= cur.instalments().size(); i++) {
            var inst = cur.instalments().get(i - 1);
            svc.bill("L1", i, inst.dueDate());
            cur = svc.repay("L1", "r" + i, Money.ofMinor(inst.principalDue() + inst.interestDue(), Currency.THB), inst.dueDate());
        }
        assertThat(cur.status()).isEqualTo(Loan.Status.CLOSED);
        assertThat(bal(LoanService.principalAcct("L1"))).isZero();
    }

    @Test
    void restructuringAtTheSameRateWithNoArrearsBooksNoLoss() {
        Loan l = billAndPay(open(), 1);
        LocalDate day = l.instalments().get(0).dueDate().plusDays(1);
        Loan r = svc.restructure("L1", "same", new BigDecimal("0.18"), 11, day);
        assertThat(bal(LoanService.MODIFICATION_LOSS)).isZero();
        assertThat(bal(LoanService.principalAcct("L1"))).isEqualTo(-outstandingPrincipal(r));
        Loan closed = svc.settle("L1", "end", day.plusDays(1));
        assertThat(closed.status()).isEqualTo(Loan.Status.CLOSED);
        assertThatThrownBy(() -> svc.restructure("L1", "late", new BigDecimal("0.10"), 5, day)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void writeOffMovesEverythingOffTheBooksAndTracksRecoveries() throws IOException {
        Loan l = inArrears();
        LocalDate due1 = l.instalments().get(0).dueDate();
        assertThatThrownBy(() -> svc.writeOff("L1", "w", due1.plusDays(100), false)).hasMessageContaining("360 days");
        LocalDate day = due1.plusDays(360);
        long owed = 10_000_000 + 150_000 + 734;
        Loan w = svc.writeOff("L1", "w1", day, false);
        assertThat(w.status()).isEqualTo(Loan.Status.WRITTEN_OFF);
        assertThat(bal(LoanService.principalAcct("L1"))).isZero();
        assertThat(bal(LoanService.interestAcct("L1"))).isZero();
        assertThat(bal(LoanService.penaltyAcct("L1"))).isZero();
        assertThat(-bal(LoanService.WRITE_OFF_EXPENSE)).isEqualTo(owed);
        assertThat(svc.writeOff("L1", "w1", day, false).status()).isEqualTo(Loan.Status.WRITTEN_OFF);   // retry
        assertThatThrownBy(() -> svc.writeOff("L1", "w2", day, false)).isInstanceOf(IllegalStateException.class);
        // the debt is remembered off balance sheet
        assertThat(ledger.currentBalance(T, LoanService.writtenOffMemo("L1"), BalanceType.CONTINGENT, Currency.THB).minor()).isEqualTo(-owed);
        // no more income accrues on a written-off loan
        assertThat(svc.accrueDaily("L1", day.plusDays(5)).status()).isEqualTo(Loan.Status.WRITTEN_OFF);
        // recoveries: income, memo shrinks, never more than is owed
        assertThat(svc.recover("L1", "rec1", Money.ofMinor(1_000_000, Currency.THB), day.plusDays(10)).minor()).isEqualTo(owed - 1_000_000);
        assertThat(bal(LoanService.RECOVERY_INCOME)).isEqualTo(1_000_000);
        assertThat(svc.recover("L1", "rec1", Money.ofMinor(1_000_000, Currency.THB), day.plusDays(10)).minor()).isEqualTo(owed - 1_000_000);   // retry
        assertThatThrownBy(() -> svc.recover("L1", "rec2", Money.ofMinor(owed, Currency.THB), day.plusDays(11))).hasMessageContaining("exceeds");
        assertThat(svc.recover("L1", "rec3", Money.ofMinor(owed - 1_000_000, Currency.THB), day.plusDays(12)).isZero()).isTrue();
        // an active loan has no recoveries
        wire(yaml());
        open();
        assertThatThrownBy(() -> svc.recover("L1", "x", Money.ofMinor(1, Currency.THB), D0)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void earlyWriteOffNeedsAnOverrideAndWrittenOffLoansLeaveTheActiveList() throws IOException {
        Loan l = open();
        assertThatThrownBy(() -> svc.writeOff("L1", "w", D0.plusDays(30), false)).isInstanceOf(IllegalStateException.class);
        Loan w = svc.writeOff("L1", "w", D0.plusDays(30), true);
        assertThat(w.status()).isEqualTo(Loan.Status.WRITTEN_OFF);
        LoanRepo.InMemory repo = new LoanRepo.InMemory();
        repo.save(l);
        repo.save(w.withStatus(Loan.Status.WRITTEN_OFF));
        assertThat(repo.activeIds()).isEmpty();
        // a product with no write-off rule needs the override too
        wire(yaml().replaceAll("(?s)delinquency:.*?accounting:", "accounting:"));
        open();
        assertThatThrownBy(() -> svc.writeOff("L1", "w", D0.plusDays(400), false)).hasMessageContaining("override");
    }
}
