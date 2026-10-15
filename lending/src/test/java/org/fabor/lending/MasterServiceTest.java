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
import org.fabor.engine.product.ProductDefinition;
import org.fabor.engine.product.ProductLoader;
import org.fabor.ledger.application.LedgerService;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.ledger.domain.Direction;
import org.fabor.ledger.domain.Entry;
import org.fabor.ledger.domain.PostingBatch;
import org.fabor.ledger.testkit.InMemoryLedgerStore;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.IdempotencyKey;
import org.fabor.platform.tenancy.TenantId;
import org.fabor.platform.time.BusinessCalendar;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class MasterServiceTest {
    static final TenantId T = new TenantId("bank-a");
    static final LocalDate D0 = LocalDate.of(2026, 1, 15);
    private LedgerService ledger;
    private LoanService loans;
    private MasterService master;
    private LoanRepo loanRepo;
    private ProductDefinition product;

    static Money thb(long minor) {
        return Money.ofMinor(minor, Currency.THB);
    }

    /** The sample loan turned into a flat-rate hire purchase with 7% VAT on the interest part of each instalment. */
    static String yaml() throws IOException {
        try (var in = MasterServiceTest.class.getResourceAsStream("/personal-loan.yaml")) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8).replace("rate_type: FIXED", "rate_type: FLAT")
                    .replace("rate: 0.18", "rate: 0.05").replace("method: ANNUITY", "method: ANNUITY_FROM_FLAT")
                    .replace("applies_to: [FEES]", "applies_to: [FEES, INSTALMENT_INTEREST]");
        }
    }

    @BeforeEach
    void setUp() throws IOException {
        product = ProductLoader.parse(yaml());
        ledger = new LedgerService(new InMemoryLedgerStore(), Clock.fixed(Instant.parse("2030-12-31T00:00:00Z"), ZoneOffset.UTC));
        loanRepo = new LoanRepo.InMemory();
        loans = new LoanService(T, ledger, loanRepo, (c, v) -> c.equals(product.product()) && v == 1 ? product : null,
                BusinessCalendar.monToFri(Set.of()));
        master = new MasterService(new MasterRepo.InMemory(), loans, loanRepo);
        fund("seed", 2_000_000_000L);
    }

    private void fund(String ref, long minor) {
        ledger.post(PostingBatch.of(T, new BatchId(ref), new IdempotencyKey(ref), D0.minusDays(30), List.of(
                new Entry(new AccountId("gl:cash"), BalanceType.SETTLED, Direction.DEBIT, thb(minor)),
                new Entry(new AccountId("dep:FLEET"), BalanceType.SETTLED, Direction.CREDIT, thb(minor)))));
    }

    private long bal(AccountId a) {
        return ledger.balance(T, a, BalanceType.SETTLED, Currency.THB, LocalDate.of(2040, 1, 1)).minor();
    }

    private MasterAgreement sign() {
        return master.sign("MA-1", "fleet-co", "THB", thb(100_000_000), "PERSONAL_LOAN_STD", 1, 30, List.of(
                new MasterAgreement.RateCardRow("TRUCK", 12, 36, new BigDecimal("0.035"), LocalDate.of(2026, 1, 1), null),
                new MasterAgreement.RateCardRow("TRUCK", 12, 36, new BigDecimal("0.033"), LocalDate.of(2026, 6, 1), null),
                new MasterAgreement.RateCardRow("TRUCK", 37, 60, new BigDecimal("0.04"), LocalDate.of(2026, 1, 1), null),
                new MasterAgreement.RateCardRow("PICKUP", 12, 60, new BigDecimal("0.03"), LocalDate.of(2026, 1, 1),
                        LocalDate.of(2026, 12, 31))), D0);
    }

    private Loan callOff(String loanId, String cls, long principal, int term, LocalDate date) {
        return master.callOff("MA-1", loanId, cls, List.of("V-" + loanId + "-1", "V-" + loanId + "-2"), thb(principal), term,
                date, "FLEET", "DEALER");
    }

    @Test
    void aCallOffLocksTheRateCardRateAndPaysTheDealerInFull() {
        sign();
        Loan s1 = callOff("S-01", "TRUCK", 40_000_000, 24, D0);
        assertThat(s1.rateOverride()).isEqualByComparingTo("0.035");
        // flat 3.5% for two years on 400,000.00: 28,000.00 of interest
        assertThat(s1.instalments().stream().mapToLong(Loan.Instalment::interestDue).sum()).isEqualTo(2_800_000);
        assertThat(s1.depositAccountId()).isEqualTo("FLEET");
        assertThat(bal(new AccountId("dep:DEALER"))).isEqualTo(40_000_000);                  // the dealer gets the whole principal
        long fee = 200_000;                                                                   // 1% of the principal, capped at 2,000.00
        assertThat(bal(new AccountId("dep:FLEET"))).isEqualTo(2_000_000_000L - fee - 14_000); // the customer pays fee and its 7% VAT
        assertThat(bal(LoanService.principalAcct("S-01"))).isEqualTo(-40_000_000);
        // later rate card row and another term range, another class
        assertThat(callOff("S-02", "TRUCK", 10_000_000, 24, LocalDate.of(2026, 7, 1)).rateOverride()).isEqualByComparingTo("0.033");
        assertThat(callOff("S-03", "TRUCK", 10_000_000, 48, D0).rateOverride()).isEqualByComparingTo("0.04");
        assertThat(callOff("S-04", "PICKUP", 10_000_000, 12, D0).rateOverride()).isEqualByComparingTo("0.03");
        assertThat(master.schedules("MA-1")).extracting(MasterAgreement.Schedule::loanId)
                .containsExactly("S-01", "S-02", "S-03", "S-04");
    }

    @Test
    void theFacilityLimitCoversTheOutstandingPrincipal() {
        sign();
        callOff("S-01", "TRUCK", 40_000_000, 24, D0);
        callOff("S-02", "TRUCK", 40_000_000, 24, D0);
        assertThat(master.utilisation("MA-1")).isEqualTo(thb(80_000_000));
        assertThat(master.headroom("MA-1")).isEqualTo(thb(20_000_000));
        assertThatThrownBy(() -> callOff("S-03", "TRUCK", 30_000_000, 24, D0)).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("headroom");
        assertThat(loanRepo.find("S-03")).isEmpty();
        // a call-off that exactly uses the headroom is fine; repaying principal frees limit again
        callOff("S-03", "TRUCK", 20_000_000, 24, D0);
        assertThat(master.headroom("MA-1").isZero()).isTrue();
        Loan s1 = loanRepo.find("S-01").orElseThrow();
        loans.bill("S-01", 1, s1.instalments().get(0).dueDate());
        Loan.Instalment i1 = loanRepo.find("S-01").orElseThrow().instalments().get(0);
        loans.repay("S-01", "p", thb(i1.principalDue() + i1.interestDue() + i1.vatDue()), i1.dueDate());
        assertThat(master.headroom("MA-1")).isEqualTo(thb(i1.principalDue()));
    }

    @Test
    void callOffsAreRefusedWithoutAMatchingRateOrAnActiveAgreement() {
        sign();
        assertThatThrownBy(() -> callOff("X", "BUS", 10_000_000, 24, D0)).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("No rate card row");
        assertThatThrownBy(() -> callOff("X", "TRUCK", 10_000_000, 6, D0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> callOff("X", "TRUCK", 10_000_000, 24, LocalDate.of(2025, 12, 31)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> callOff("X", "PICKUP", 10_000_000, 24, LocalDate.of(2027, 1, 1)))   // card row has expired
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> master.callOff("MA-1", "X", "TRUCK", List.of(), Money.ofMinor(1_000_000, Currency.USD), 24, D0,
                "FLEET", "DEALER")).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("THB");
        assertThatThrownBy(() -> master.callOff("NOPE", "X", "TRUCK", List.of(), thb(1), 24, D0, "FLEET", "DEALER"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(this::sign).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> master.sign("MA-2", "p", "THB", Money.ofMinor(1, Currency.USD), "P", 1, 30,
                List.of(new MasterAgreement.RateCardRow("T", 1, 2, BigDecimal.ZERO, D0, null)), D0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void repeatingACallOffDoesNotDrawTwice() {
        sign();
        Loan first = callOff("S-01", "TRUCK", 40_000_000, 24, D0);
        Loan again = callOff("S-01", "TRUCK", 40_000_000, 24, D0);
        assertThat(again).isEqualTo(first);
        assertThat(master.utilisation("MA-1")).isEqualTo(thb(40_000_000));
        assertThat(master.schedules("MA-1")).hasSize(1);
    }

    @Test
    void oneInvoiceCoversEverySchedulesDueInstalmentsWithVatPerVehicle() {
        sign();
        callOff("S-01", "TRUCK", 40_000_000, 24, D0);
        callOff("S-02", "PICKUP", 20_000_000, 12, D0);
        assertThat(master.invoice("MA-1", D0.plusMonths(1)).lines()).isEmpty();              // nothing billed yet
        Loan s1 = loanRepo.find("S-01").orElseThrow();
        Loan s2 = loanRepo.find("S-02").orElseThrow();
        loans.bill("S-01", 1, s1.instalments().get(0).dueDate());
        loans.bill("S-02", 1, s2.instalments().get(0).dueDate());
        LocalDate asOf = s1.instalments().get(0).dueDate().plusDays(3);
        ConsolidatedInvoice inv = master.invoice("MA-1", asOf);
        assertThat(inv.number()).isEqualTo("MA-MA-1-" + asOf);
        assertThat(inv.lines()).extracting(ConsolidatedInvoice.Line::loanId).containsExactlyInAnyOrder("S-01", "S-02");
        assertThat(inv.lines()).isSortedAccordingTo(java.util.Comparator.comparing(ConsolidatedInvoice.Line::dueDate)
                .thenComparing(ConsolidatedInvoice.Line::loanId));
        assertThat(inv.total()).isEqualTo(inv.lines().stream().mapToLong(ConsolidatedInvoice.Line::total).sum());
        long vat = inv.lines().stream().mapToLong(ConsolidatedInvoice.Line::vat).sum();
        assertThat(vat).isPositive();
        // each schedule has two vehicles: the VAT of an instalment is split between them, an odd satang to the first
        assertThat(inv.vehicleVat()).hasSize(4);
        assertThat(inv.vehicleVat().stream().mapToLong(ConsolidatedInvoice.VehicleVat::vat).sum()).isEqualTo(vat);
        for (ConsolidatedInvoice.Line l : inv.lines()) {
            List<ConsolidatedInvoice.VehicleVat> shares = inv.vehicleVat().stream().filter(v -> v.loanId().equals(l.loanId())).toList();
            assertThat(shares.get(0).vat()).isGreaterThanOrEqualTo(shares.get(1).vat());
            assertThat(shares.stream().mapToLong(ConsolidatedInvoice.VehicleVat::vat).sum()).isEqualTo(l.vat());
        }
        // an instalment that is not due yet on the invoice day is left off
        assertThat(master.invoice("MA-1", s1.instalments().get(0).dueDate().minusDays(1)).lines()).isEmpty();
    }

    @Test
    void onePaymentIsSpreadAcrossSchedulesOldestDueFirst() {
        sign();
        callOff("S-01", "TRUCK", 40_000_000, 24, D0);
        callOff("S-02", "PICKUP", 20_000_000, 12, D0.plusDays(20));
        Loan s1 = loanRepo.find("S-01").orElseThrow();
        Loan s2 = loanRepo.find("S-02").orElseThrow();
        loans.bill("S-01", 1, s1.instalments().get(0).dueDate());
        loans.bill("S-02", 1, s2.instalments().get(0).dueDate());
        LocalDate day = s2.instalments().get(0).dueDate();
        ConsolidatedInvoice inv = master.invoice("MA-1", day);
        assertThat(inv.lines()).hasSize(2);
        assertThat(inv.lines().get(0).loanId()).isEqualTo("S-01");                              // the older instalment is first
        long first = inv.lines().get(0).total();
        // a payment that clears the first schedule's instalment and part of the second
        master.collect("MA-1", "pay1", thb(first + 100_000), day);
        assertThat(loanRepo.find("S-01").orElseThrow().instalments().get(0).settled()).isTrue();
        assertThat(loanRepo.find("S-02").orElseThrow().instalments().get(0).outstanding()).isEqualTo(inv.lines().get(1).total() - 100_000);
        long afterPartial = master.invoice("MA-1", day).total();
        master.collect("MA-1", "pay1", thb(first + 100_000), day);                               // same reference: nothing more
        assertThat(master.invoice("MA-1", day).total()).isEqualTo(afterPartial);
        assertThatThrownBy(() -> master.collect("MA-1", "pay1", thb(1), day)).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("larger payment");
        assertThatThrownBy(() -> master.collect("MA-1", "pay2", thb(afterPartial + 1), day))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("exceeds");
        assertThatThrownBy(() -> master.collect("MA-1", "pay3", thb(0), day)).isInstanceOf(IllegalArgumentException.class);
        master.collect("MA-1", "pay4", thb(afterPartial), day);
        assertThat(master.invoice("MA-1", day).lines()).isEmpty();
        assertThat(bal(LoanService.vatAcct("S-01"))).isZero();
    }

    @Test
    void aScheduleThatIsLateDefaultsTheWholeAgreementUntilItIsCured() {
        sign();
        callOff("S-01", "TRUCK", 40_000_000, 24, D0);
        callOff("S-02", "PICKUP", 20_000_000, 12, D0);
        Loan s1 = loanRepo.find("S-01").orElseThrow();
        LocalDate due = s1.instalments().get(0).dueDate();
        loans.bill("S-01", 1, due);
        assertThat(master.evaluate("MA-1", due.plusDays(29)).status()).isEqualTo(MasterAgreement.Status.ACTIVE);
        assertThat(master.evaluate("MA-1", due.plusDays(31)).status()).isEqualTo(MasterAgreement.Status.DEFAULTED);
        assertThat(master.find("MA-1").orElseThrow().status()).isEqualTo(MasterAgreement.Status.DEFAULTED);
        assertThat(master.evaluate("MA-1", due.plusDays(40)).status()).isEqualTo(MasterAgreement.Status.DEFAULTED);   // already
        assertThatThrownBy(() -> callOff("S-03", "TRUCK", 1_000_000, 24, due.plusDays(31))).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DEFAULTED");
        assertThatThrownBy(() -> master.cure("MA-1", due.plusDays(31))).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("overdue");
        master.collect("MA-1", "catch-up", thb(master.invoice("MA-1", due.plusDays(31)).total()), due.plusDays(31));
        assertThat(master.cure("MA-1", due.plusDays(31)).status()).isEqualTo(MasterAgreement.Status.ACTIVE);
        assertThatThrownBy(() -> master.cure("MA-1", due.plusDays(31))).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not DEFAULTED");
        assertThatThrownBy(() -> master.schedules("NOPE")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aCoTerminusScheduleEndsWithTheLatestExistingOne() {
        sign();
        assertThatThrownBy(() -> master.coTerminusTerm("MA-1", D0)).isInstanceOf(IllegalStateException.class);
        callOff("S-01", "TRUCK", 40_000_000, 24, D0);
        callOff("S-02", "PICKUP", 10_000_000, 12, D0);
        // the longest schedule ends 24 months after the call-off (on the next business day when that falls on a weekend)
        assertThat(master.coTerminusTerm("MA-1", D0)).isBetween(23, 24);
        assertThat(master.coTerminusTerm("MA-1", D0.plusMonths(18))).isBetween(5, 6);
        assertThat(master.coTerminusTerm("MA-1", D0.plusMonths(23).plusDays(20))).isEqualTo(1);   // never below one month
        // a closed schedule no longer counts
        loans.settle("S-01", "s", D0);
        assertThat(master.coTerminusTerm("MA-1", D0)).isBetween(11, 12);
    }

    @Test
    void rateCardRowsAreValidated() {
        LocalDate d = D0;
        for (Object[] bad : new Object[][] {{"", 1, 2, "0.05"}, {"T", 0, 2, "0.05"}, {"T", 3, 2, "0.05"}, {"T", 1, 2, "-0.01"},
                {"T", 1, 2, "1.5"}}) {
            assertThatThrownBy(() -> new MasterAgreement.RateCardRow((String) bad[0], (int) bad[1], (int) bad[2],
                    new BigDecimal((String) bad[3]), d, null)).isInstanceOf(IllegalArgumentException.class);
        }
        assertThatThrownBy(() -> new MasterAgreement.RateCardRow(null, 1, 2, BigDecimal.ZERO, d, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new MasterAgreement.RateCardRow("T", 1, 2, null, d, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new MasterAgreement.RateCardRow("T", 1, 2, BigDecimal.ZERO, null, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new MasterAgreement.RateCardRow("T", 1, 2, BigDecimal.ZERO, d, d.minusDays(1)))
                .isInstanceOf(IllegalArgumentException.class);
        var row = new MasterAgreement.RateCardRow("T", 1, 2, BigDecimal.ZERO, d, d.plusDays(5));
        assertThat(List.of(row)).hasSize(1);
        for (int[] bad : new int[][] {{0, 30}, {1, 0}}) {
            assertThatThrownBy(() -> new MasterAgreement("M", "p", "THB", bad[0] == 0 ? 0 : 1, "P", 1, bad[1], List.of(row),
                    MasterAgreement.Status.ACTIVE, d)).isInstanceOf(IllegalArgumentException.class);
        }
        assertThatThrownBy(() -> new MasterAgreement("M", "p", "THB", 1, "P", 1, 30, List.of(), MasterAgreement.Status.ACTIVE, d))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new MasterAgreement("M", "p", "THB", 1, "P", 1, 30, null, MasterAgreement.Status.ACTIVE, d))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(new MasterRepo.InMemory().find("none")).isEmpty();
    }
}
