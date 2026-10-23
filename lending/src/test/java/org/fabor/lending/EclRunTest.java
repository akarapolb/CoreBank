package org.fabor.lending;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.function.BiFunction;
import org.fabor.engine.ecl.ExpectedCreditLoss;
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

class EclRunTest {
    static final TenantId T = new TenantId("bank-a");
    static final LocalDate D0 = LocalDate.of(2026, 1, 15);
    static final ExpectedCreditLoss.Parameters PARAMS = ExpectedCreditLoss.Parameters.of("0.04", "0.45");

    private ProductDefinition product;
    private LedgerService ledger;
    private LoanRepo repo;
    private LoanService loans;
    private EclRun run;

    @BeforeEach
    void setUp() throws IOException {
        String yaml;
        try (var in = EclRunTest.class.getResourceAsStream("/personal-loan.yaml")) {
            yaml = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
        product = ProductLoader.parse(yaml);
        ledger = new LedgerService(new InMemoryLedgerStore(), Clock.fixed(Instant.parse("2026-12-31T00:00:00Z"), ZoneOffset.UTC));
        repo = new LoanRepo.InMemory();
        BiFunction<String, Integer, ProductDefinition> products = (c, v) -> c.equals(product.product()) && v == 1 ? product : null;
        loans = new LoanService(T, ledger, repo, products, BusinessCalendar.monToFri(Set.of()));
        run = new EclRun(repo, new EclService(T, ledger, repo, products));
        ledger.post(PostingBatch.of(T, new BatchId("seed"), new IdempotencyKey("seed"), D0.minusDays(30), List.of(
                new Entry(new AccountId("gl:cash"), BalanceType.SETTLED, Direction.DEBIT, Money.ofMinor(90_000_000, Currency.THB)),
                new Entry(new AccountId("dep:D1"), BalanceType.SETTLED, Direction.CREDIT, Money.ofMinor(90_000_000, Currency.THB)))));
    }

    private Loan open(String id) {
        return loans.disburse(id, "party-" + id, "PERSONAL_LOAN_STD", 1, Money.of(new BigDecimal("100000"), Currency.THB), 12, D0, "D1");
    }

    private long allowance(String loanId) {
        return ledger.balance(T, EclService.allowanceAcct(loanId), BalanceType.SETTLED, Currency.THB, LocalDate.of(2040, 1, 1)).minor();
    }

    @Test
    void theRunBooksEveryLoanByStageAndSummarisesTheAllowance() {
        open("L1");
        Loan late = open("L2");
        open("L3");
        LocalDate due1 = late.instalments().get(0).dueDate();
        loans.bill("L2", 1, due1);
        EclRun.Summary s = run.run(due1.plusDays(100), PARAMS, id -> id.equals("L3"));
        assertThat(s.assessed()).isEqualTo(3);
        assertThat(s.stage1()).isEqualTo(1);
        assertThat(s.stage2()).isEqualTo(1);             // L3: the bank's own test says credit risk has increased
        assertThat(s.stage3()).isEqualTo(1);             // L2: 100 days past due
        assertThat(s.inactive()).isZero();
        assertThat(s.failures()).isEmpty();
        long booked = allowance("L1") + allowance("L2") + allowance("L3");
        assertThat(booked).isPositive();
        assertThat(s.allowanceByCurrency().get("THB")).isEqualTo(booked);
        assertThat(allowance("L2")).isGreaterThan(allowance("L1"));
        EclRun.Summary again = run.run(due1.plusDays(100), PARAMS, id -> id.equals("L3"));            // same day: nothing more
        assertThat(allowance("L1") + allowance("L2") + allowance("L3")).isEqualTo(booked);
        assertThat(again.allowanceByCurrency()).isEqualTo(s.allowanceByCurrency());
    }

    @Test
    void aLoanThatHasLeftServicingHasItsAllowanceReleasedByTheNextRun() {
        Loan l = open("L1");
        LocalDate day = l.instalments().get(0).dueDate();
        run.run(day, PARAMS, id -> false);
        assertThat(allowance("L1")).isPositive();
        loans.settle("L1", "s1", day.plusDays(1));
        EclRun.Summary s = run.run(day.plusDays(2), PARAMS, id -> false);
        assertThat(allowance("L1")).isZero();
        assertThat(s.assessed()).isZero();
        assertThat(s.inactive()).isEqualTo(1);
        assertThat(s.allowanceByCurrency()).isEmpty();
    }

    @Test
    void oneFailingLoanIsReportedAndTheOthersStillBooked() {
        open("L1");
        LoanRepo flaky = new LoanRepo() {
            @Override
            public void save(Loan loan) {
                repo.save(loan);
            }

            @Override
            public java.util.Optional<Loan> find(String id) {
                if (id.equals("BAD")) {
                    throw new IllegalStateException("cannot read loan");
                }
                return repo.find(id);
            }

            @Override
            public List<String> idsByParty(String party) {
                return repo.idsByParty(party);
            }

            @Override
            public List<String> activeIds() {
                return repo.activeIds();
            }

            @Override
            public List<String> allIds() {
                return List.of("BAD", "L1");
            }
        };
        BiFunction<String, Integer, ProductDefinition> products = (c, v) -> product;
        EclRun r = new EclRun(flaky, new EclService(T, ledger, flaky, products));
        EclRun.Summary s = r.run(D0.plusDays(1), PARAMS, id -> false);
        assertThat(s.failures()).containsExactly("BAD: cannot read loan");
        assertThat(s.assessed()).isEqualTo(1);
        assertThat(allowance("L1")).isPositive();
    }

    @Test
    void allIdsFallsBackToActiveIdsForRepositoriesThatCannotTellMore() {
        open("L1");
        LoanRepo basic = new LoanRepo() {
            @Override
            public void save(Loan loan) { }

            @Override
            public java.util.Optional<Loan> find(String id) {
                return repo.find(id);
            }

            @Override
            public List<String> idsByParty(String party) {
                return List.of();
            }

            @Override
            public List<String> activeIds() {
                return List.of("L1");
            }
        };
        assertThat(basic.allIds()).containsExactly("L1");
        loans.settle("L1", "s", D0.plusMonths(1));
        assertThat(repo.allIds()).containsExactly("L1");
        assertThat(repo.activeIds()).isEmpty();
    }
}
