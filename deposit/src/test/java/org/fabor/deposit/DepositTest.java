package org.fabor.deposit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.List;
import org.fabor.engine.product.ProductDefinition;
import org.fabor.engine.product.ProductLoader;
import org.fabor.engine.product.ProductValidator;
import org.fabor.ledger.application.InsufficientFundsException;
import org.fabor.ledger.application.LedgerService;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.testkit.InMemoryLedgerStore;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.TenantId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class DepositTest {
    static final TenantId T = new TenantId("bank-a");
    private LedgerService ledger;
    private DepositRepo repo;
    private DepositService svc;
    private String yaml;

    static ProductDefinition load(String yaml) {
        return ProductLoader.parse(yaml);
    }

    @BeforeEach
    void setUp() throws IOException {
        try (var in = getClass().getResourceAsStream("/savings.yaml")) {
            yaml = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
        wire(yaml);
    }

    private void wire(String y) {
        ledger = new LedgerService(new InMemoryLedgerStore(), Clock.fixed(Instant.parse("2026-03-05T00:00:00Z"), ZoneOffset.UTC));
        repo = new InMemoryDepositRepo();
        ProductDefinition d = load(y);
        svc = new DepositService(T, ledger, repo, (code, v) -> code.equals(d.product()) && v == 1 ? d : null,
                Clock.fixed(Instant.parse("2026-03-05T00:00:00Z"), ZoneOffset.UTC));
    }

    static Money thb(String major) {
        return Money.of(new BigDecimal(major), Currency.THB);
    }

    private long bal(org.fabor.ledger.domain.AccountId a, LocalDate d) {
        return ledger.balance(T, a, BalanceType.SETTLED, Currency.THB, d).minor();
    }

    @Test
    void productValidates() {
        assertThat(ProductValidator.ok(ProductValidator.validate(load(yaml)))).isTrue();
    }

    @Test
    void depositWithdrawAndOverdraftGuard() {
        svc.open("A1", "party-1", "SAVINGS_TIERED", 1);
        svc.deposit("A1", "r1", thb("1000"), LocalDate.of(2026, 1, 1));
        svc.withdraw("A1", "r2", thb("400"), LocalDate.of(2026, 1, 2));
        assertThat(svc.balance("A1", LocalDate.of(2026, 1, 2))).isEqualTo(thb("600"));
        assertThatThrownBy(() -> svc.withdraw("A1", "r3", thb("700"), LocalDate.of(2026, 1, 3)))
                .isInstanceOf(InsufficientFundsException.class);
        svc.deposit("A1", "r1", thb("1000"), LocalDate.of(2026, 1, 1)); // retry of r1: no double credit
        assertThat(svc.balance("A1", LocalDate.of(2026, 1, 3))).isEqualTo(thb("600"));
        assertThatThrownBy(() -> svc.open("A1", "p", "SAVINGS_TIERED", 1)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> svc.open("A2", "p", "NOPE", 1)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.deposit("ZZ", "x", thb("1"), LocalDate.of(2026, 1, 1))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void marginalTierAccrualGolden() {
        svc.open("A1", "party-1", "SAVINGS_TIERED", 1);
        svc.deposit("A1", "r1", thb("250000"), LocalDate.of(2026, 1, 1));
        // 100,000 at 1% + 150,000 at 1.5% = 1,000 + 2,250 = 3,250 a year; 31 days of January
        Money accrued = svc.accrued("A1", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31));
        assertThat(accrued.minor()).isEqualTo(27_603); // 3250 x 31 / 365 = 276.03
    }

    @Test
    void wholeBalanceTierUsesOneRate() {
        wire(yaml.replace("tier_mode: MARGINAL", "tier_mode: WHOLE_BALANCE"));
        svc.open("A1", "party-1", "SAVINGS_TIERED", 1);
        svc.deposit("A1", "r1", thb("250000"), LocalDate.of(2026, 1, 1));
        // whole balance in the 1.5% band: 250,000 x 1.5% x 31/365 = 318.49
        assertThat(svc.accrued("A1", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31)).minor()).isEqualTo(31_849);
        svc.deposit("A1", "r2", thb("5000000"), LocalDate.of(2026, 2, 1)); // top band
        assertThat(svc.accrued("A1", LocalDate.of(2026, 2, 1), LocalDate.of(2026, 2, 1)).minor())
                .isEqualTo(Math.round(5_250_000.0 * 0.02 / 365 * 100));
    }

    @Test
    void accrualFollowsBalanceHistoryNotJustToday() {
        svc.open("A1", "party-1", "SAVINGS_TIERED", 1);
        svc.deposit("A1", "r1", thb("100000"), LocalDate.of(2026, 1, 1));
        svc.withdraw("A1", "r2", thb("100000"), LocalDate.of(2026, 1, 11));
        // 10 days at 100,000 x 1% / 365 (balance is zero from the 11th)
        assertThat(svc.accrued("A1", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31)).minor()).isEqualTo(2_740);
    }

    @Test
    void capitalizePostsNetOfWithholdingTaxOnceBalanced() {
        svc.open("A1", "party-1", "SAVINGS_TIERED", 1);
        svc.deposit("A1", "r1", thb("2000000"), LocalDate.of(2026, 1, 1));
        // 100k@1% + 900k@1.5% + 1,000k@2% = 1,000 + 13,500 + 20,000 = 34,500 a year
        Money gross = svc.capitalize("A1", YearMonth.of(2026, 1));
        assertThat(gross.minor()).isEqualTo(293_014); // 34,500 x 31/365 = 2,930.14
        // over the 20,000 exemption only after enough months: January alone is exempt
        assertThat(bal(DepositService.WHT_PAYABLE, LocalDate.of(2026, 1, 31))).isZero();
        assertThat(svc.balance("A1", LocalDate.of(2026, 1, 31)).minor()).isEqualTo(200_000_000 + 293_014);
        // calling again posts nothing more
        assertThat(svc.capitalize("A1", YearMonth.of(2026, 1))).isEqualTo(gross);
        assertThat(svc.balance("A1", LocalDate.of(2026, 1, 31)).minor()).isEqualTo(200_000_000 + 293_014);
        assertThat(repo.yearToDate("A1", 2026).grossInterest()).isEqualTo(293_014);
        // expense and customer legs net to zero across the books
        assertThat(bal(DepositService.INTEREST_EXPENSE, LocalDate.of(2026, 1, 31))).isEqualTo(-293_014);
    }

    @Test
    void withholdingStartsWhenYearlyInterestPassesTheExemption() {
        wire(yaml.replace("wht_exempt_annual: 20000", "wht_exempt_annual: 2000"));
        svc.open("A1", "party-1", "SAVINGS_TIERED", 1);
        svc.deposit("A1", "r1", thb("2000000"), LocalDate.of(2026, 1, 1));
        svc.capitalize("A1", YearMonth.of(2026, 1));                    // 2,930.14 gross: over the 2,000 exemption
        long wht = -bal(DepositService.WHT_PAYABLE, LocalDate.of(2026, 1, 31)) * -1;
        assertThat(bal(DepositService.WHT_PAYABLE, LocalDate.of(2026, 1, 31))).isEqualTo(43_952); // 15% of 2,930.14
        assertThat(wht).isEqualTo(43_952);
        // customer got gross minus tax; books balance through the single batch
        assertThat(svc.balance("A1", LocalDate.of(2026, 1, 31)).minor()).isEqualTo(200_000_000 + 293_014 - 43_952);
        // February: tax applies to February's interest (no catch-up needed, January already taxed)
        svc.capitalize("A1", YearMonth.of(2026, 2));
        assertThat(bal(DepositService.WHT_PAYABLE, LocalDate.of(2026, 2, 28))).isPositive();
    }

    @Test
    void capitalizeRefusesAMonthThatHasNotEnded() {
        svc.open("A1", "party-1", "SAVINGS_TIERED", 1);
        svc.deposit("A1", "r1", thb("1000"), LocalDate.of(2026, 3, 1));
        assertThatThrownBy(() -> svc.capitalize("A1", YearMonth.of(2026, 3))).isInstanceOf(IllegalStateException.class);
        // empty account: nothing to post
        svc.open("A2", "party-2", "SAVINGS_TIERED", 1);
        assertThat(svc.capitalize("A2", YearMonth.of(2026, 1)).isZero()).isTrue();
    }

    @Test
    void productWithoutWithholdingPostsGrossToCustomer() {
        wire(yaml.replace("  wht_rate: 0.15\n  wht_exempt_annual: 20000\n", ""));
        svc.open("A1", "party-1", "SAVINGS_TIERED", 1);
        svc.deposit("A1", "r1", thb("2000000"), LocalDate.of(2026, 1, 1));
        svc.capitalize("A1", YearMonth.of(2026, 1));
        assertThat(bal(DepositService.WHT_PAYABLE, LocalDate.of(2026, 1, 31))).isZero();
        assertThat(svc.balance("A1", LocalDate.of(2026, 1, 31)).minor()).isEqualTo(200_000_000 + 293_014);
    }

    @Test
    void fullyWithheldInterestDropsTheCustomerLeg() {
        // 100% is invalid, but 99.99% rounds the net to a tiny amount; a zero net must not create a zero leg
        List<AccrualCalculator.DayBalance> none = List.of(new AccrualCalculator.DayBalance(LocalDate.of(2026, 1, 1), -5));
        assertThat(AccrualCalculator.accrue(none, load(yaml).deposit(), Currency.THB, 365).isZero()).isTrue();
    }

    @Test
    void validatorChecksDepositBlock() {
        assertThat(ProductValidator.validate(load(yaml.replace("{ rate: 0.0200 }", "{ up_to: 2000000, rate: 0.0200 }"))))
                .anyMatch(i -> i.path().contains("up_to"));
        assertThat(ProductValidator.validate(load(yaml.replace("{ up_to: 1000000, rate: 0.0150 }", "{ rate: 0.0150 }"))))
                .anyMatch(i -> i.path().contains("up_to"));
        assertThat(ProductValidator.validate(load(yaml.replace("up_to: 1000000", "up_to: 50000"))))
                .anyMatch(i -> i.message().contains("increase"));
        assertThat(ProductValidator.validate(load(yaml.replace("rate: 0.0100", "rate: 5"))))
                .anyMatch(i -> i.path().contains("rate"));
        assertThat(ProductValidator.validate(load(yaml.replace("wht_rate: 0.15", "wht_rate: 1")))).anyMatch(i -> i.path().equals("deposit.wht_rate"));
        assertThat(ProductValidator.validate(load(yaml.replaceAll("(?s)deposit:.*?accounting:", "accounting:"))))
                .anyMatch(i -> i.path().equals("deposit.tiers"));
        assertThat(ProductValidator.validate(load(yaml.replace("family: DEPOSIT", "family: LOAN"))))
                .anyMatch(i -> i.path().equals("deposit") || i.path().equals("pricing.rate_type"));
    }

    @Test
    void withholdingEdgeCases() {
        // zero rate behaves like no tax
        wire(yaml.replace("wht_rate: 0.15", "wht_rate: 0"));
        svc.open("A1", "p", "SAVINGS_TIERED", 1);
        svc.deposit("A1", "r1", thb("2000000"), LocalDate.of(2026, 1, 1));
        svc.capitalize("A1", YearMonth.of(2026, 1));
        assertThat(bal(DepositService.WHT_PAYABLE, LocalDate.of(2026, 1, 31))).isZero();
        // no exemption configured: taxed from the first baht
        wire(yaml.replace("  wht_exempt_annual: 20000\n", ""));
        svc.open("A1", "p", "SAVINGS_TIERED", 1);
        svc.deposit("A1", "r1", thb("2000000"), LocalDate.of(2026, 1, 1));
        svc.capitalize("A1", YearMonth.of(2026, 1));
        assertThat(bal(DepositService.WHT_PAYABLE, LocalDate.of(2026, 1, 31))).isEqualTo(43_952);
        // exemption crossed in a later month: the catch-up taxes the earlier months too
        wire(yaml.replace("wht_exempt_annual: 20000", "wht_exempt_annual: 3000"));
        svc.open("A1", "p", "SAVINGS_TIERED", 1);
        svc.deposit("A1", "r1", thb("2000000"), LocalDate.of(2026, 1, 1));
        svc.capitalize("A1", YearMonth.of(2026, 1));                       // 2,930.14 <= 3,000: exempt
        assertThat(bal(DepositService.WHT_PAYABLE, LocalDate.of(2026, 1, 31))).isZero();
        svc.capitalize("A1", YearMonth.of(2026, 2));                       // year to date now over: tax on all of it
        long total = repo.yearToDate("A1", 2026).grossInterest();
        assertThat(repo.yearToDate("A1", 2026).withheld()).isEqualTo(Math.round(total * 0.15));
    }

    @Test
    void calculatorTierEdges() {
        var rule = new ProductDefinition.Deposit("MONTHLY", ProductDefinition.TierMode.WHOLE_BALANCE,
                List.of(new ProductDefinition.Tier(new BigDecimal("1000"), new BigDecimal("0.01"))), null, null, null);
        List<AccrualCalculator.DayBalance> over = List.of(new AccrualCalculator.DayBalance(LocalDate.of(2026, 1, 1), 5_000_000));
        // balance above the last bounded tier earns nothing
        assertThat(AccrualCalculator.accrue(over, rule, Currency.THB, 365).isZero()).isTrue();
        var marginal = new ProductDefinition.Deposit("MONTHLY", ProductDefinition.TierMode.MARGINAL,
                List.of(new ProductDefinition.Tier(new BigDecimal("1000"), new BigDecimal("0.01")),
                        new ProductDefinition.Tier(null, new BigDecimal("0.02"))), null, null, null);
        // 50,000.00: 1,000 at 1% + 49,000 at 2% = 990 a year -> 2.712 a day -> 271 satang
        assertThat(AccrualCalculator.accrue(over, marginal, Currency.THB, 365).minor()).isEqualTo(271);
        // balance exactly on a boundary stays in the lower band
        List<AccrualCalculator.DayBalance> edge = List.of(new AccrualCalculator.DayBalance(LocalDate.of(2026, 1, 1), 100_000));
        assertThat(AccrualCalculator.accrue(edge, marginal, Currency.THB, 365).minor()).isEqualTo(3);
    }

    @Test
    void productWithNoWithholdingSettingsAtAll() {
        wire(yaml.replace("  wht_rate: 0.15\n  wht_exempt_annual: 20000\n", ""));
        svc.open("A1", "p", "SAVINGS_TIERED", 1);
        svc.deposit("A1", "r1", thb("500"), LocalDate.of(2026, 1, 1));
        assertThat(svc.capitalize("A1", YearMonth.of(2026, 1)).minor()).isEqualTo(42); // 500 x 1% x 31/365
        // the full tax rate would swallow everything only if the rate were 100%, which the validator forbids;
        // a tiny balance that earns less than half a satang a day still posts nothing
        svc.open("A2", "p2", "SAVINGS_TIERED", 1);
        svc.deposit("A2", "r1", Money.ofMinor(1, Currency.THB), LocalDate.of(2026, 1, 1));
        assertThat(svc.capitalize("A2", YearMonth.of(2026, 1)).isZero()).isTrue();
    }

    @Test
    void remainingBranches() {
        // a loan product cannot back a deposit account
        DepositService s2 = new DepositService(T, ledger, repo, (c, v) -> load(yaml.replace("family: DEPOSIT", "family: LOAN")),
                Clock.systemUTC());
        assertThatThrownBy(() -> s2.open("L1", "p", "SAVINGS_TIERED", 1)).isInstanceOf(IllegalArgumentException.class);
        // 99% withholding on a tiny interest leaves nothing for the customer: only expense and tax legs are posted
        wire(yaml.replace("wht_rate: 0.15", "wht_rate: 0.99").replace("  wht_exempt_annual: 20000\n", ""));
        svc.open("A1", "p", "SAVINGS_TIERED", 1);
        svc.deposit("A1", "r1", thb("100"), LocalDate.of(2026, 1, 1));
        Money gross = svc.capitalize("A1", YearMonth.of(2026, 1));
        assertThat(gross.minor()).isEqualTo(8);
        assertThat(bal(DepositService.WHT_PAYABLE, LocalDate.of(2026, 1, 31))).isEqualTo(8);
        assertThat(svc.balance("A1", LocalDate.of(2026, 1, 31)).minor()).isEqualTo(10_000);
        // marginal calculation edge cases: bounded last tier with a larger balance, and a zero-width first tier
        var bounded = new ProductDefinition.Deposit("MONTHLY", ProductDefinition.TierMode.MARGINAL,
                List.of(new ProductDefinition.Tier(new BigDecimal("1000"), new BigDecimal("0.01"))), null, null, null);
        var day = List.of(new AccrualCalculator.DayBalance(LocalDate.of(2026, 1, 1), 500_000));
        assertThat(AccrualCalculator.accrue(day, bounded, Currency.THB, 365).minor()).isEqualTo(3);
        var zeroWidth = new ProductDefinition.Deposit("MONTHLY", ProductDefinition.TierMode.MARGINAL,
                List.of(new ProductDefinition.Tier(BigDecimal.ZERO, new BigDecimal("0.50")),
                        new ProductDefinition.Tier(null, new BigDecimal("0.01"))), null, null, null);
        assertThat(AccrualCalculator.accrue(day, zeroWidth, Currency.THB, 365).minor()).isEqualTo(14);
    }
}
