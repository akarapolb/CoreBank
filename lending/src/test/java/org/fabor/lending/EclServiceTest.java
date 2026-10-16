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
import org.fabor.engine.ecl.ExpectedCreditLoss;
import org.fabor.engine.ecl.ExpectedCreditLoss.Stage;
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
import org.junit.jupiter.api.Test;

class EclServiceTest {
    static final TenantId T = new TenantId("bank-a");
    static final LocalDate D0 = LocalDate.of(2026, 1, 15);
    static final ExpectedCreditLoss.Parameters PARAMS = ExpectedCreditLoss.Parameters.of("0.04", "0.45");

    private ProductDefinition product;
    private LedgerService ledger;
    private LoanService loans;
    private EclService ecl;

    private static String yaml() throws IOException {
        try (var in = EclServiceTest.class.getResourceAsStream("/personal-loan.yaml")) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private void wire(String y) {
        product = ProductLoader.parse(y);
        ledger = new LedgerService(new InMemoryLedgerStore(), Clock.fixed(Instant.parse("2026-12-31T00:00:00Z"), ZoneOffset.UTC));
        LoanRepo repo = new LoanRepo.InMemory();
        java.util.function.BiFunction<String, Integer, ProductDefinition> products =
                (c, v) -> c.equals(product.product()) && v == 1 ? product : null;
        loans = new LoanService(T, ledger, repo, products, BusinessCalendar.monToFri(Set.of()));
        ecl = new EclService(T, ledger, repo, products);
        ledger.post(PostingBatch.of(T, new BatchId("seed"), new IdempotencyKey("seed"), D0.minusDays(30), List.of(
                new Entry(new AccountId("gl:cash"), BalanceType.SETTLED, Direction.DEBIT, Money.ofMinor(20_000_000, Currency.THB)),
                new Entry(new AccountId("dep:D1"), BalanceType.SETTLED, Direction.CREDIT, Money.ofMinor(20_000_000, Currency.THB)))));
    }

    private Loan open() {
        return loans.disburse("L1", "party-1", "PERSONAL_LOAN_STD", 1, Money.of(new BigDecimal("100000"), Currency.THB), 12, D0, "D1");
    }

    private long bal(AccountId a) {
        return ledger.balance(T, a, BalanceType.SETTLED, Currency.THB, LocalDate.of(2040, 1, 1)).minor();
    }

    @Test
    void aPerformingLoanCarriesAStageOneAllowanceBookedOnce() throws IOException {
        wire(yaml());
        open();
        ExpectedCreditLoss.Result r = ecl.book("L1", D0, false, PARAMS);
        assertThat(r.stage()).isEqualTo(Stage.STAGE_1);
        assertThat(r.allowance().minor()).isPositive();
        assertThat(bal(EclService.allowanceAcct("L1"))).isEqualTo(r.allowance().minor());
        assertThat(bal(EclService.ECL_EXPENSE)).isEqualTo(-r.allowance().minor());
        ecl.book("L1", D0, false, PARAMS);                                    // same day again: nothing more
        assertThat(bal(EclService.allowanceAcct("L1"))).isEqualTo(r.allowance().minor());
        assertThat(ecl.book("L1", D0.plusDays(1), true, PARAMS).stage()).isEqualTo(Stage.STAGE_2);
        // a 12-month loan has the same horizon in stage 2 as in stage 1, so the allowance does not fall (it can only grow)
        assertThat(bal(EclService.allowanceAcct("L1"))).isGreaterThanOrEqualTo(r.allowance().minor());
    }

    @Test
    void arrearsMoveTheLoanToStageThreeAndPaymentOrSettlementReleasesTheAllowance() throws IOException {
        wire(yaml());
        Loan l = open();
        LocalDate due1 = l.instalments().get(0).dueDate();
        long stage1 = ecl.book("L1", D0, false, PARAMS).allowance().minor();
        loans.bill("L1", 1, due1);
        assertThat(ecl.assess("L1", due1.plusDays(10), false, PARAMS).stage()).isEqualTo(Stage.STAGE_1);
        assertThat(ecl.assess("L1", due1, false, PARAMS).stage()).isEqualTo(Stage.STAGE_1);          // not yet overdue
        assertThat(ecl.assess("L1", due1.plusDays(35), false, PARAMS).stage()).isEqualTo(Stage.STAGE_2);
        ExpectedCreditLoss.Result s3 = ecl.book("L1", due1.plusDays(95), false, PARAMS);
        assertThat(s3.stage()).isEqualTo(Stage.STAGE_3);
        assertThat(s3.allowance().minor()).isGreaterThan(stage1);
        assertThat(bal(EclService.allowanceAcct("L1"))).isEqualTo(s3.allowance().minor());
        loans.settle("L1", "s1", due1.plusDays(96));
        ExpectedCreditLoss.Result closed = ecl.book("L1", due1.plusDays(97), false, PARAMS);
        assertThat(closed.allowance().isZero()).isTrue();
        assertThat(bal(EclService.allowanceAcct("L1"))).isZero();
        assertThat(bal(EclService.ECL_EXPENSE)).isZero();                                          // fully released
    }

    @Test
    void aNonAccrualLoanIsImpairedWhateverItsDaysPastDue() throws IOException {
        wire(yaml());
        Loan l = open();
        loans.bill("L1", 1, l.instalments().get(0).dueDate());
        loans.writeOff("L1", "w", l.instalments().get(0).dueDate().plusDays(400), true);
        assertThat(ecl.assess("L1", l.instalments().get(0).dueDate().plusDays(401), false, PARAMS).allowance().isZero()).isTrue();
    }

    @Test
    void aFlatRateLoanIsAssessedAtItsImpliedRate() throws IOException {
        wire(yaml().replace("rate_type: FIXED", "rate_type: FLAT").replace("rate: 0.18", "rate: 0.06")
                .replace("method: ANNUITY", "method: ANNUITY_FROM_FLAT"));
        open();
        ExpectedCreditLoss.Result r = ecl.assess("L1", D0, false, PARAMS);
        assertThat(r.stage()).isEqualTo(Stage.STAGE_1);
        assertThat(r.allowance().minor()).isPositive();
    }

    @Test
    void unknownLoansAndProductsAreRefused() throws IOException {
        wire(yaml());
        open();
        assertThatThrownBy(() -> ecl.assess("NOPE", D0, false, PARAMS)).isInstanceOf(IllegalArgumentException.class);
        EclService orphan = new EclService(T, ledger, new LoanRepo() {
            @Override
            public void save(Loan loan) { }

            @Override
            public java.util.Optional<Loan> find(String id) {
                return java.util.Optional.of(new Loan("X", "p", "GONE", 1, "THB", "D1", D0, 1_000, List.of(
                        new Loan.Instalment(1, D0.plusMonths(1), 1_000, 10, 0, 0, 0, 0, false)), Loan.Status.ACTIVE));
            }

            @Override
            public List<String> idsByParty(String party) {
                return List.of();
            }

            @Override
            public List<String> activeIds() {
                return List.of();
            }
        }, (c, v) -> null);
        assertThatThrownBy(() -> orphan.assess("X", D0, false, PARAMS)).isInstanceOf(IllegalStateException.class);
    }
}
