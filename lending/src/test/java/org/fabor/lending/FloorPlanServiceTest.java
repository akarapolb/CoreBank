package org.fabor.lending;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.fabor.ledger.application.InsufficientFundsException;
import org.fabor.ledger.application.LedgerService;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.ledger.domain.Direction;
import org.fabor.ledger.domain.Entry;
import org.fabor.ledger.domain.PostingBatch;
import org.fabor.ledger.testkit.InMemoryLedgerStore;
import org.fabor.lending.FloorPlanLine.UnitType;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.IdempotencyKey;
import org.fabor.platform.tenancy.TenantId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class FloorPlanServiceTest {
    static final TenantId T = new TenantId("bank-a");
    static final LocalDate D0 = LocalDate.of(2026, 1, 15);
    private LedgerService ledger;
    private FloorPlanService svc;
    private LoanRepo loans;

    static Money thb(long minor) {
        return Money.ofMinor(minor, Currency.THB);
    }

    @BeforeEach
    void setUp() {
        ledger = new LedgerService(new InMemoryLedgerStore(), Clock.fixed(Instant.parse("2030-12-31T00:00:00Z"), ZoneOffset.UTC));
        loans = new LoanRepo.InMemory();
        svc = new FloorPlanService(T, ledger, new FloorPlanRepo.InMemory(), loans);
        fund("seed", 1_000_000_000L);
        svc.open(line("FP-1"));
    }

    private void fund(String ref, long minor) {
        ledger.post(PostingBatch.of(T, new BatchId(ref), new IdempotencyKey(ref), D0.minusDays(30), List.of(
                new Entry(new AccountId("gl:cash"), BalanceType.SETTLED, Direction.DEBIT, thb(minor)),
                new Entry(new AccountId("dep:DLR"), BalanceType.SETTLED, Direction.CREDIT, thb(minor)))));
    }

    private long bal(AccountId a) {
        return ledger.balance(T, a, BalanceType.SETTLED, Currency.THB, LocalDate.of(2040, 1, 1)).minor();
    }

    /** 1,000,000.00 line at 9%: new units 800,000.00 with 60 interest-free days, used units 400,000.00 from day one. */
    static FloorPlanLine line(String id) {
        return new FloorPlanLine(id, "DLR-1", "THB", 100_000_000, new BigDecimal("0.09"), 2, "DLR", Map.of(
                UnitType.NEW, new FloorPlanLine.UnitTerms(80_000_000, 60),
                UnitType.USED, new FloorPlanLine.UnitTerms(40_000_000, 0)),
                List.of(new FloorPlanLine.Step(120, 10), new FloorPlanLine.Step(180, 25), new FloorPlanLine.Step(270, 100)),
                FloorPlanLine.Status.ACTIVE, D0);
    }

    private FloorPlanUnit draw(String unit, UnitType type, long amount, LocalDate date) {
        return svc.draw("FP-1", unit, type, thb(amount), date, "OEM-ACCT");
    }

    @Test
    void aDrawdownPaysTheDistributorAndRespectsTheLimits() {
        FloorPlanUnit u = draw("VIN1", UnitType.NEW, 50_000_000, D0);
        assertThat(u.principalOutstanding()).isEqualTo(50_000_000);
        assertThat(bal(FloorPlanService.principalAcct("FP-1", "VIN1"))).isEqualTo(-50_000_000);
        assertThat(bal(new AccountId("dep:OEM-ACCT"))).isEqualTo(50_000_000);
        assertThat(svc.exposure("FP-1")).isEqualTo(thb(50_000_000));
        // the NEW sub-limit is 800,000.00: 500,000.00 + 400,000.00 is too much, though the line has room
        assertThatThrownBy(() -> draw("VIN2", UnitType.NEW, 40_000_000, D0)).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("NEW sub-limit");
        draw("VIN3", UnitType.USED, 40_000_000, D0);
        assertThatThrownBy(() -> draw("VIN4", UnitType.USED, 1_000_000, D0)).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("USED sub-limit");
        assertThatThrownBy(() -> draw("VIN5", UnitType.NEW, 30_000_000, D0)).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("line limit");  // 500 + 400 + 300 is over the line, whatever the sub-limits say
        draw("VIN5", UnitType.NEW, 10_000_000, D0);
        assertThat(svc.exposure("FP-1")).isEqualTo(thb(100_000_000));
        // the line itself is full
        assertThatThrownBy(() -> draw("VIN6", UnitType.NEW, 1, D0)).isInstanceOf(IllegalStateException.class).hasMessageContaining("line limit");
        // misuse
        assertThatThrownBy(() -> draw("VIN1", UnitType.NEW, 1, D0)).isInstanceOf(IllegalStateException.class).hasMessageContaining("already financed");
        assertThatThrownBy(() -> draw("VIN7", UnitType.DEMO, 1, D0)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("DEMO");
        assertThatThrownBy(() -> svc.draw("FP-1", "VIN8", UnitType.NEW, Money.ofMinor(1, Currency.USD), D0, "OEM"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> draw("VIN9", UnitType.NEW, 0, D0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.draw("NOPE", "V", UnitType.NEW, thb(1), D0, "OEM")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.repay("FP-1", "NOPE", "r", thb(1), D0)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aFrozenLineTakesNoNewDrawdownsButStillTakesRepayments() {
        draw("VIN1", UnitType.NEW, 10_000_000, D0);
        assertThat(svc.freeze("FP-1").status()).isEqualTo(FloorPlanLine.Status.FROZEN);
        assertThatThrownBy(() -> draw("VIN2", UnitType.NEW, 1_000_000, D0)).isInstanceOf(IllegalStateException.class).hasMessageContaining("FROZEN");
        assertThat(svc.repay("FP-1", "VIN1", "r1", thb(1_000_000), D0).principalPaid()).isEqualTo(1_000_000);
        assertThat(svc.unfreeze("FP-1").status()).isEqualTo(FloorPlanLine.Status.ACTIVE);
        draw("VIN2", UnitType.NEW, 1_000_000, D0);
        assertThat(svc.findLine("FP-1")).isPresent();
        assertThat(svc.findUnit("FP-1", "VIN2")).isPresent();
        assertThat(svc.findLine("NOPE")).isEmpty();
    }

    @Test
    void theManufacturerBearsTheInterestFreePeriodAndTheDealerPaysAfterIt() {
        draw("VIN1", UnitType.NEW, 50_000_000, D0);
        FloorPlanUnit free = svc.accrue("FP-1", "VIN1", D0.plusDays(60));
        // 500,000.00 x 9% x 60/365 = 7,397.26, all of it the manufacturer's
        assertThat(free.subvention()).isEqualTo(739_726);
        assertThat(free.interestAccrued()).isZero();
        assertThat(bal(FloorPlanService.OEM_SUBVENTION_RECEIVABLE)).isEqualTo(-739_726);
        assertThat(bal(FloorPlanService.interestAcct("FP-1", "VIN1"))).isZero();
        // 30 more days are the dealer's: 500,000.00 x 9% x 30/365 = 3,698.63
        FloorPlanUnit charged = svc.accrue("FP-1", "VIN1", D0.plusDays(90));
        assertThat(charged.interestAccrued()).isEqualTo(369_863);
        assertThat(charged.subvention()).isEqualTo(739_726);
        assertThat(bal(FloorPlanService.interestAcct("FP-1", "VIN1"))).isEqualTo(-369_863);
        assertThat(bal(LoanService.INTEREST_INCOME)).isEqualTo(739_726 + 369_863);
        // accruing the same day again, or an earlier one, changes nothing
        assertThat(svc.accrue("FP-1", "VIN1", D0.plusDays(90))).isEqualTo(charged);
        assertThat(svc.accrue("FP-1", "VIN1", D0.plusDays(10))).isEqualTo(charged);
        // one go from the draw gives the same split
        draw("VIN2", UnitType.NEW, 10_000_000, D0);
        FloorPlanUnit straddle = svc.accrue("FP-1", "VIN2", D0.plusDays(90));
        assertThat(straddle.subvention()).isEqualTo(147_945);      // 100,000.00 x 9% x 60/365
        assertThat(straddle.interestAccrued()).isEqualTo(73_973);  // x 30/365
        // a used unit has no interest-free period
        draw("VIN3", UnitType.USED, 10_000_000, D0);
        FloorPlanUnit used = svc.accrue("FP-1", "VIN3", D0.plusDays(30));
        assertThat(used.subvention()).isZero();
        assertThat(used.interestAccrued()).isEqualTo(73_973);
    }

    @Test
    void curtailmentsFallDueAsTheUnitAges() {
        draw("VIN1", UnitType.NEW, 50_000_000, D0);
        assertThat(svc.principalDue("FP-1", "VIN1", D0.plusDays(119))).isZero();
        assertThat(svc.principalDue("FP-1", "VIN1", D0.plusDays(120))).isEqualTo(5_000_000);    // 10%
        assertThat(svc.principalDue("FP-1", "VIN1", D0.plusDays(180))).isEqualTo(12_500_000);   // 25%
        assertThat(svc.principalDue("FP-1", "VIN1", D0.plusDays(270))).isEqualTo(50_000_000);   // the rest
        // paying the first curtailment (interest first) clears it
        LocalDate d = D0.plusDays(120);
        FloorPlanService.Statement st = svc.statement("FP-1", d);
        assertThat(st.rows()).singleElement().satisfies(r -> {
            assertThat(r.principalDue()).isEqualTo(5_000_000);
            assertThat(r.interestDue()).isEqualTo(369_863 * 2);         // 60 chargeable days
            assertThat(r.saleOverdue()).isFalse();
        });
        assertThat(st.total()).isEqualTo(5_000_000 + 739_726);
        FloorPlanUnit paid = svc.repay("FP-1", "VIN1", "c1", thb(st.total()), d);
        assertThat(paid.principalPaid()).isEqualTo(5_000_000);
        assertThat(paid.interestOutstanding()).isZero();
        assertThat(svc.principalDue("FP-1", "VIN1", d)).isZero();
        assertThat(svc.principalDue("FP-1", "VIN1", D0.plusDays(180))).isEqualTo(7_500_000);   // 25% of 50m less the 5m paid
        assertThat(bal(FloorPlanService.principalAcct("FP-1", "VIN1"))).isEqualTo(-45_000_000);
        assertThat(bal(FloorPlanService.interestAcct("FP-1", "VIN1"))).isZero();
        // a repeat of the same payment reference takes nothing more
        svc.repay("FP-1", "VIN1", "c1", thb(st.total()), d);
        assertThat(bal(FloorPlanService.principalAcct("FP-1", "VIN1"))).isEqualTo(-45_000_000);
    }

    @Test
    void repaymentsTakeInterestFirstAndAreChecked() {
        draw("VIN1", UnitType.USED, 10_000_000, D0);
        LocalDate d = D0.plusDays(30);
        // 100,000.00 x 9% x 30/365 = 739.73 of interest; a small payment is all interest
        FloorPlanUnit p = svc.repay("FP-1", "VIN1", "a", thb(50_000), d);
        assertThat(p.interestPaid()).isEqualTo(50_000);
        assertThat(p.principalPaid()).isZero();
        assertThat(p.interestOutstanding()).isEqualTo(73_973 - 50_000);
        assertThatThrownBy(() -> svc.repay("FP-1", "VIN1", "b", thb(10_100_000), d)).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("exceeds");
        assertThatThrownBy(() -> svc.repay("FP-1", "VIN1", "c", thb(0), d)).isInstanceOf(IllegalArgumentException.class);
        // the dealer needs the money in the settlement account
        FloorPlanService poor = new FloorPlanService(T, ledger, new FloorPlanRepo.InMemory(), loans);
        poor.open(new FloorPlanLine("FP-2", "DLR-2", "THB", 10_000_000, new BigDecimal("0.09"), 2, "EMPTY",
                Map.of(UnitType.NEW, new FloorPlanLine.UnitTerms(10_000_000, 0)), List.of(), FloorPlanLine.Status.ACTIVE, D0));
        poor.draw("FP-2", "U1", UnitType.NEW, thb(1_000_000), D0, "OEM-ACCT");
        assertThatThrownBy(() -> poor.repay("FP-2", "U1", "x", thb(1_000), D0)).isInstanceOf(InsufficientFundsException.class);
        assertThat(poor.findUnit("FP-2", "U1").orElseThrow().principalPaid()).isZero();
        assertThatThrownBy(() -> poor.open(line("FP-2"))).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void aStockAuditFlagsMissingUnitsOverdueSalesAndStrangers() {
        draw("VIN1", UnitType.NEW, 10_000_000, D0);
        draw("VIN2", UnitType.NEW, 10_000_000, D0);
        draw("VIN3", UnitType.NEW, 10_000_000, D0);
        draw("VIN4", UnitType.NEW, 10_000_000, D0);
        LocalDate sold = D0.plusDays(30);
        svc.recordSale("FP-1", "VIN3", sold);                        // sold and not paid off
        svc.recordSale("FP-1", "VIN4", sold);
        svc.payoff("FP-1", "VIN4", "po4", sold);                     // sold and paid: gone from stock, not a problem
        LocalDate audit = sold.plusDays(5);
        FloorPlanService.StockAudit a = svc.stockAudit("FP-1", audit, java.util.Set.of("VIN1", "VIN9"));
        assertThat(a.missing()).containsExactly("VIN2");
        assertThat(a.saleOverdue()).containsExactly("VIN3");
        assertThat(a.unexpected()).containsExactly("VIN9");
        assertThat(a.soldOutOfTrust()).containsExactly("VIN2", "VIN3");
        assertThat(a.checked()).isEqualTo(3);
        assertThat(a.clean()).isFalse();
        FloorPlanService.StockAudit clean = svc.stockAudit("FP-1", D0.plusDays(1), java.util.Set.of("VIN1", "VIN2", "VIN3"));
        assertThat(clean.clean()).isTrue();
        assertThat(clean.soldOutOfTrust()).isEmpty();
        assertThatThrownBy(() -> svc.stockAudit("NOPE", audit, java.util.Set.of())).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aSoldUnitMustBePaidOffWithinTheWindow() {
        draw("VIN1", UnitType.NEW, 50_000_000, D0);
        LocalDate sold = D0.plusDays(100);
        assertThatThrownBy(() -> svc.recordSale("FP-1", "VIN1", D0.minusDays(1))).isInstanceOf(IllegalArgumentException.class);
        svc.recordSale("FP-1", "VIN1", sold);
        assertThat(svc.recordSale("FP-1", "VIN1", sold).soldOn()).isEqualTo(sold);       // again: no change
        assertThatThrownBy(() -> svc.recordSale("FP-1", "VIN1", sold.plusDays(1))).isInstanceOf(IllegalStateException.class);
        assertThat(svc.principalDue("FP-1", "VIN1", sold)).isEqualTo(50_000_000);          // all of it is due once sold
        assertThat(svc.overdueSales("FP-1", sold.plusDays(2))).isEmpty();                  // the window is two days
        assertThat(svc.overdueSales("FP-1", sold.plusDays(3))).extracting(FloorPlanUnit::unitId).containsExactly("VIN1");
        assertThat(svc.statement("FP-1", sold.plusDays(3)).rows()).singleElement().satisfies(r -> assertThat(r.saleOverdue()).isTrue());
        // payoff on day 101: principal plus the dealer's interest for the 41 days after the interest-free period
        Money quote = svc.payoffAmount("FP-1", "VIN1", sold.plusDays(1));
        assertThat(quote.minor()).isEqualTo(50_000_000 + 505_479);
    }

    @Test
    void payoffClosesTheUnitAndFreesTheLine() {
        draw("VIN1", UnitType.NEW, 50_000_000, D0);
        LocalDate payDay = D0.plusDays(90);
        svc.recordSale("FP-1", "VIN1", payDay);
        Money quote = svc.payoffAmount("FP-1", "VIN1", payDay);
        assertThat(quote.minor()).isEqualTo(50_000_000 + 369_863);                            // 30 chargeable days
        FloorPlanUnit paid = svc.payoff("FP-1", "VIN1", "sale", payDay);
        assertThat(paid.status()).isEqualTo(FloorPlanUnit.Status.PAID);
        assertThat(bal(FloorPlanService.principalAcct("FP-1", "VIN1"))).isZero();
        assertThat(bal(FloorPlanService.interestAcct("FP-1", "VIN1"))).isZero();
        assertThat(svc.exposure("FP-1").isZero()).isTrue();
        assertThat(svc.payoffAmount("FP-1", "VIN1", payDay.plusDays(5)).isZero()).isTrue();
        assertThat(svc.principalDue("FP-1", "VIN1", payDay)).isZero();
        assertThat(svc.statement("FP-1", payDay).rows()).isEmpty();
        // retries and late calls
        assertThat(svc.payoff("FP-1", "VIN1", "sale", payDay).status()).isEqualTo(FloorPlanUnit.Status.PAID);
        assertThat(svc.accrue("FP-1", "VIN1", payDay.plusDays(30))).isEqualTo(paid);
        assertThatThrownBy(() -> svc.payoff("FP-1", "VIN1", "again", payDay)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.repay("FP-1", "VIN1", "late", thb(1), payDay)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> svc.recordSale("FP-1", "VIN1", payDay)).isInstanceOf(IllegalStateException.class);
        // the freed room can be drawn again
        draw("VIN2", UnitType.NEW, 80_000_000, payDay);
    }

    @Test
    void aRetailLoanFromTheBankSettlesTheUnit() {
        draw("VIN1", UnitType.NEW, 50_000_000, D0);
        LocalDate d = D0.plusDays(30);
        loans.save(new Loan("R-SMALL", "buyer-1", "HP", 1, "THB", "BUYER", d, 40_000_000, List.of(), Loan.Status.ACTIVE));
        loans.save(new Loan("R-OK", "buyer-2", "HP", 1, "THB", "BUYER", d, 50_000_000, List.of(), Loan.Status.ACTIVE));
        loans.save(new Loan("R-DONE", "buyer-3", "HP", 1, "THB", "BUYER", d, 50_000_000, List.of(), Loan.Status.CLOSED));
        assertThatThrownBy(() -> svc.settleFromRetailLoan("FP-1", "VIN1", "NOPE", "n", d)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.settleFromRetailLoan("FP-1", "VIN1", "R-DONE", "n", d)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> svc.settleFromRetailLoan("FP-1", "VIN1", "R-SMALL", "n", d)).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("does not cover");
        assertThat(svc.findUnit("FP-1", "VIN1").orElseThrow().soldOn()).isNull();           // a refused settlement records nothing
        FloorPlanUnit settled = svc.settleFromRetailLoan("FP-1", "VIN1", "R-OK", "n", d);
        assertThat(settled.status()).isEqualTo(FloorPlanUnit.Status.PAID);
        assertThat(settled.soldOn()).isEqualTo(d);
    }

    @Test
    void lineTermsAreValidated() {
        Map<UnitType, FloorPlanLine.UnitTerms> ok = Map.of(UnitType.NEW, new FloorPlanLine.UnitTerms(1, 0));
        List<FloorPlanLine.Step> noSteps = List.of();
        BigDecimal rate = new BigDecimal("0.09");
        assertThatThrownBy(() -> new FloorPlanLine("L", "D", "THB", 0, rate, 2, "A", ok, noSteps, FloorPlanLine.Status.ACTIVE, D0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new FloorPlanLine("L", "D", "THB", 1, null, 2, "A", ok, noSteps, FloorPlanLine.Status.ACTIVE, D0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new FloorPlanLine("L", "D", "THB", 1, new BigDecimal("-0.1"), 2, "A", ok, noSteps, FloorPlanLine.Status.ACTIVE, D0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new FloorPlanLine("L", "D", "THB", 1, new BigDecimal("1.1"), 2, "A", ok, noSteps, FloorPlanLine.Status.ACTIVE, D0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new FloorPlanLine("L", "D", "THB", 1, rate, -1, "A", ok, noSteps, FloorPlanLine.Status.ACTIVE, D0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new FloorPlanLine("L", "D", "THB", 1, rate, 2, "A", Map.of(), noSteps, FloorPlanLine.Status.ACTIVE, D0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new FloorPlanLine("L", "D", "THB", 1, rate, 2, "A", null, noSteps, FloorPlanLine.Status.ACTIVE, D0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new FloorPlanLine("L", "D", "THB", 1, rate, 2, "A", ok, null, FloorPlanLine.Status.ACTIVE, D0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new FloorPlanLine("L", "D", "THB", 1, rate, 2, "A",
                Map.of(UnitType.NEW, new FloorPlanLine.UnitTerms(2, 0)), noSteps, FloorPlanLine.Status.ACTIVE, D0))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("sub-limit");
        for (List<FloorPlanLine.Step> bad : List.of(
                List.of(new FloorPlanLine.Step(100, 20), new FloorPlanLine.Step(100, 30)),
                List.of(new FloorPlanLine.Step(100, 20), new FloorPlanLine.Step(120, 20)),
                List.of(new FloorPlanLine.Step(100, 20), new FloorPlanLine.Step(90, 30)))) {
            assertThatThrownBy(() -> new FloorPlanLine("L", "D", "THB", 1, rate, 2, "A", ok, bad, FloorPlanLine.Status.ACTIVE, D0))
                    .isInstanceOf(IllegalArgumentException.class);
        }
        assertThatThrownBy(() -> new FloorPlanLine.Step(0, 10)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new FloorPlanLine.Step(10, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new FloorPlanLine.Step(10, 101)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new FloorPlanLine.UnitTerms(0, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new FloorPlanLine.UnitTerms(1, -1)).isInstanceOf(IllegalArgumentException.class);
        // a closed line cannot be frozen or unfrozen
        FloorPlanService closed = new FloorPlanService(T, ledger, new FloorPlanRepo.InMemory(), loans);
        closed.open(line("FP-9").withStatus(FloorPlanLine.Status.CLOSED));
        assertThatThrownBy(() -> closed.freeze("FP-9")).isInstanceOf(IllegalStateException.class);
        assertThat(new FloorPlanRepo.InMemory().findUnit("x", "y")).isEmpty();
    }
}
