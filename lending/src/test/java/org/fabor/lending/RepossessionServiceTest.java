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
import java.util.Optional;
import java.util.Set;
import java.util.function.BiFunction;
import org.fabor.assets.Asset;
import org.fabor.assets.AssetRepo;
import org.fabor.assets.AssetService;
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

class RepossessionServiceTest {
    static final TenantId T = new TenantId("bank-a");
    static final LocalDate D0 = LocalDate.of(2026, 1, 15);

    private LedgerService ledger;
    private LoanService loans;
    private LoanRepo loanRepo;
    private AssetService assets;
    private RepossessionService service;
    private LocalDate due1;

    static Money thb(long minor) {
        return Money.ofMinor(minor, Currency.THB);
    }

    @BeforeEach
    void setUp() throws IOException {
        String yaml;
        try (var in = RepossessionServiceTest.class.getResourceAsStream("/personal-loan.yaml")) {
            yaml = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
        ProductDefinition product = ProductLoader.parse(yaml);
        ledger = new LedgerService(new InMemoryLedgerStore(), Clock.fixed(Instant.parse("2026-12-31T00:00:00Z"), ZoneOffset.UTC));
        loanRepo = new LoanRepo.InMemory();
        BiFunction<String, Integer, ProductDefinition> products = (c, v) -> c.equals(product.product()) && v == 1 ? product : null;
        loans = new LoanService(T, ledger, loanRepo, products, BusinessCalendar.monToFri(Set.of()));
        assets = new AssetService(new AssetRepo.InMemory(), id -> loanRepo.find(id)
                .map(l -> new AssetService.ContractState(id, l.status() == Loan.Status.CLOSED)));
        service = new RepossessionService(T, ledger, loans, loanRepo, assets, new RepossessionRepo.InMemory());
        ledger.post(PostingBatch.of(T, new BatchId("seed"), new IdempotencyKey("seed"), D0.minusDays(30), List.of(
                new Entry(new AccountId("gl:cash"), BalanceType.SETTLED, Direction.DEBIT, thb(50_000_000)),
                new Entry(new AccountId("dep:D1"), BalanceType.SETTLED, Direction.CREDIT, thb(50_000_000)))));
        Loan l = loans.disburse("L1", "party-1", "PERSONAL_LOAN_STD", 1, Money.of(new BigDecimal("100000"), Currency.THB), 12, D0, "D1");
        due1 = l.instalments().get(0).dueDate();
        loans.bill("L1", 1, due1);
        assets.order("A1", Asset.Kind.VEHICLE, "Isuzu", "FVM", "VIN-1", "DLR-1", thb(12_000_000), "Customer address");
        assets.deliver("A1", "1AB 1234", "ENG-1", D0);
        assets.activate("A1", "L1", D0, false);
    }

    private long bal(AccountId a) {
        return ledger.balance(T, a, BalanceType.SETTLED, Currency.THB, LocalDate.of(2040, 1, 1)).minor();
    }

    @Test
    void aSaleThatClearsTheDebtClosesTheLoanAndLeavesTheSurplusWithTheCustomer() {
        LocalDate day = due1.plusDays(40);
        Repossession open = service.repossess("R1", "L1", "A1", day, "Yard Bangna", Asset.Condition.FAIR);
        assertThat(open.status()).isEqualTo(Repossession.Status.OPEN);
        assertThat(assets.find("A1").orElseThrow().status()).isEqualTo(Asset.Status.REPOSSESSED);
        assertThat(service.repossess("R1", "L1", "A1", day, "elsewhere", Asset.Condition.POOR)).isEqualTo(open);   // retry
        long deposit = bal(new AccountId("dep:D1"));
        long quote = loans.settlementQuote("L1", day.plusDays(10)).minor();
        Repossession sold = service.sell("R1", day.plusDays(10), thb(15_000_000), thb(500_000));
        assertThat(sold.status()).isEqualTo(Repossession.Status.SOLD);
        assertThat(sold.owed()).isEqualTo(quote);
        assertThat(sold.shortfall()).isZero();
        assertThat(sold.surplus()).isEqualTo(14_500_000 - quote);
        assertThat(loanRepo.find("L1").orElseThrow().status()).isEqualTo(Loan.Status.CLOSED);
        assertThat(assets.find("A1").orElseThrow().status()).isEqualTo(Asset.Status.DISPOSED);
        assertThat(bal(new AccountId("dep:D1"))).isEqualTo(deposit + sold.surplus());               // the customer keeps the surplus
        assertThat(bal(RepossessionService.COSTS_PAYABLE)).isEqualTo(500_000);
        assertThat(service.sell("R1", day.plusDays(11), thb(1), thb(0))).isEqualTo(sold);            // already sold: unchanged
        assertThat(service.find("R1")).contains(sold);
        assertThat(service.forLoan("L1")).containsExactly(sold);
    }

    @Test
    void aSaleThatFallsShortWritesTheLoanOffRecoversTheNetAndKeepsTheClaim() {
        LocalDate day = due1.plusDays(40);
        service.repossess("R1", "L1", "A1", day, "Yard", Asset.Condition.POOR);
        Loan before = loanRepo.find("L1").orElseThrow();
        long claim = before.instalments().stream().mapToLong(i -> i.principalOutstanding() + i.vatOutstanding()
                + (i.billed() ? i.interestOutstanding() + i.penaltyOutstanding() : 0)).sum();
        Repossession sold = service.sell("R1", day.plusDays(5), thb(5_000_000), thb(500_000));
        assertThat(sold.surplus()).isZero();
        assertThat(sold.shortfall()).isEqualTo(claim - 4_500_000);
        assertThat(sold.owed()).isGreaterThan(4_500_000);
        assertThat(loanRepo.find("L1").orElseThrow().status()).isEqualTo(Loan.Status.WRITTEN_OFF);
        assertThat(bal(LoanService.RECOVERY_INCOME)).isEqualTo(4_500_000);
        assertThat(ledger.currentBalance(T, LoanService.writtenOffMemo("L1"), BalanceType.CONTINGENT, Currency.THB).minor())
                .isEqualTo(-sold.shortfall());                                                       // still owed by the customer
        assertThat(assets.find("A1").orElseThrow().status()).isEqualTo(Asset.Status.DISPOSED);
    }

    @Test
    void aSaleThatOnlyCoversItsCostsRecoversNothingAndWritesOffTheWholeDebt() {
        LocalDate day = due1.plusDays(40);
        service.repossess("R1", "L1", "A1", day, "Yard", Asset.Condition.DAMAGED);
        Repossession sold = service.sell("R1", day.plusDays(5), thb(400_000), thb(400_000));
        assertThat(sold.surplus()).isZero();
        assertThat(sold.shortfall()).isPositive();
        assertThat(bal(LoanService.RECOVERY_INCOME)).isZero();
        assertThat(loanRepo.find("L1").orElseThrow().status()).isEqualTo(Loan.Status.WRITTEN_OFF);
    }

    @Test
    void proceedsBetweenTheWrittenOffClaimAndTheSettlementQuoteLeaveTheRemainderWithTheCustomer() throws IOException {
        // an early-settlement rule that still charges unbilled interest makes the quote larger than the claim a write-off clears
        String yaml;
        try (var in = RepossessionServiceTest.class.getResourceAsStream("/personal-loan.yaml")) {
            yaml = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
        ProductDefinition product = ProductLoader.parse(yaml.replace("rebate: NONE", "rebate: \"PERCENT:0\""));
        BiFunction<String, Integer, ProductDefinition> products = (c, v) -> c.equals(product.product()) && v == 1 ? product : null;
        LoanRepo repo2 = new LoanRepo.InMemory();
        LoanService loans2 = new LoanService(T, ledger, repo2, products, BusinessCalendar.monToFri(Set.of()));
        Loan l = loans2.disburse("L2", "party-2", "PERSONAL_LOAN_STD", 1, Money.of(new BigDecimal("100000"), Currency.THB), 12, D0, "D1");
        loans2.bill("L2", 1, l.instalments().get(0).dueDate());
        AssetService assets2 = new AssetService(new AssetRepo.InMemory(), id -> repo2.find(id)
                .map(x -> new AssetService.ContractState(id, false)));
        assets2.order("A2", Asset.Kind.VEHICLE, "Isuzu", "FVM", "VIN-2", "DLR-1", thb(12_000_000), "x");
        assets2.deliver("A2", "2AB 1234", "ENG-2", D0);
        assets2.activate("A2", "L2", D0, false);
        RepossessionService svc2 = new RepossessionService(T, ledger, loans2, repo2, assets2, new RepossessionRepo.InMemory());
        LocalDate day = l.instalments().get(0).dueDate().plusDays(40);
        svc2.repossess("R2", "L2", "A2", day, "Yard", Asset.Condition.GOOD);
        long quote = loans2.settlementQuote("L2", day).minor();
        long claim = repo2.find("L2").orElseThrow().instalments().stream().mapToLong(i -> i.principalOutstanding()
                + i.vatOutstanding() + (i.billed() ? i.interestOutstanding() + i.penaltyOutstanding() : 0)).sum();
        assertThat(quote).isGreaterThan(claim);
        long net = claim + 1_000;                                                                    // above the claim, below the quote
        Repossession sold = svc2.sell("R2", day, thb(net), thb(0));
        assertThat(sold.shortfall()).isZero();
        assertThat(sold.surplus()).isEqualTo(1_000);
    }

    @Test
    void repossessionAndSaleAreRefusedWhenTheFactsDoNotSupportThem() {
        LocalDate day = due1.plusDays(40);
        assertThatThrownBy(() -> service.repossess("R0", "NOPE", "A1", day, "Y", Asset.Condition.FAIR))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.repossess("R0", "L1", "A1", due1, "Y", Asset.Condition.FAIR))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("nothing overdue");
        assertThatThrownBy(() -> service.repossess("R0", "L1", "NOPE", day, "Y", Asset.Condition.FAIR))
                .isInstanceOf(IllegalArgumentException.class);
        assets.order("A9", Asset.Kind.VEHICLE, "Hino", "300", "VIN-9", "DLR-1", thb(9_000_000), "x");
        assets.deliver("A9", "9AB 9999", "E9", D0);
        assertThatThrownBy(() -> service.repossess("R0", "L1", "A9", day, "Y", Asset.Condition.FAIR))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("does not secure");
        assertThatThrownBy(() -> service.sell("NOPE", day, thb(1), thb(0))).isInstanceOf(IllegalArgumentException.class);
        service.repossess("R1", "L1", "A1", day, "Yard", Asset.Condition.FAIR);
        assertThatThrownBy(() -> service.sell("R1", day, thb(0), thb(0))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.sell("R1", day, thb(100), thb(101))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.sell("R1", day, thb(100), thb(-1))).isInstanceOf(IllegalArgumentException.class);
        assertThat(service.find("NOPE")).isEqualTo(Optional.empty());
        loans.settle("L1", "s", day);
        assertThatThrownBy(() -> service.repossess("R3", "L1", "A1", day, "Y", Asset.Condition.FAIR))
                .isInstanceOf(IllegalStateException.class);
    }
}
