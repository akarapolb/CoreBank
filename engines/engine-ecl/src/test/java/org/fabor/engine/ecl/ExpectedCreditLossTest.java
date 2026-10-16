package org.fabor.engine.ecl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.List;
import org.fabor.engine.ecl.ExpectedCreditLoss.Exposure;
import org.fabor.engine.ecl.ExpectedCreditLoss.Parameters;
import org.fabor.engine.ecl.ExpectedCreditLoss.Stage;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.junit.jupiter.api.Test;

class ExpectedCreditLossTest {
    private static final Parameters P = Parameters.of("0.04", "0.45");

    private static Money thb(long minor) {
        return Money.ofMinor(minor, Currency.THB);
    }

    private static Exposure exp(int dpd, boolean impaired, boolean sicr, int months) {
        return new Exposure(thb(100_000_000), dpd, impaired, sicr, months, new BigDecimal("0.08"));
    }

    @Test
    void stagesFollowDaysPastDueImpairmentAndRiskIncrease() {
        assertThat(ExpectedCreditLoss.stage(exp(0, false, false, 24), P)).isEqualTo(Stage.STAGE_1);
        assertThat(ExpectedCreditLoss.stage(exp(29, false, false, 24), P)).isEqualTo(Stage.STAGE_1);
        assertThat(ExpectedCreditLoss.stage(exp(30, false, false, 24), P)).isEqualTo(Stage.STAGE_2);
        assertThat(ExpectedCreditLoss.stage(exp(0, false, true, 24), P)).isEqualTo(Stage.STAGE_2);
        assertThat(ExpectedCreditLoss.stage(exp(90, false, false, 24), P)).isEqualTo(Stage.STAGE_3);
        assertThat(ExpectedCreditLoss.stage(exp(0, true, false, 24), P)).isEqualTo(Stage.STAGE_3);
    }

    @Test
    void stageOneUsesTwelveMonthsAndStageTwoTheWholeLife() {
        ExpectedCreditLoss.Result s1 = ExpectedCreditLoss.compute(exp(0, false, false, 36), P);
        assertThat(s1.horizonPd()).isEqualByComparingTo("0.04");
        // 1,000,000.00 x 4% x 45% = 18,000.00, discounted half a year at 8%: slightly less
        assertThat(s1.allowance().minor()).isBetween(1_730_000L, 1_800_000L);
        ExpectedCreditLoss.Result s2 = ExpectedCreditLoss.compute(exp(0, false, true, 36), P);
        assertThat(s2.stage()).isEqualTo(Stage.STAGE_2);
        assertThat(s2.horizonPd()).isGreaterThan(s1.horizonPd());
        assertThat(s2.allowance().minor()).isGreaterThan(s1.allowance().minor());
    }

    @Test
    void aShortLoanIsCappedAtItsRemainingLifeInStageOne() {
        ExpectedCreditLoss.Result r = ExpectedCreditLoss.compute(exp(0, false, false, 6), P);
        assertThat(r.horizonPd()).isLessThan(new BigDecimal("0.04"));
    }

    @Test
    void stageThreeIsFullDefaultWithoutDiscounting() {
        ExpectedCreditLoss.Result r = ExpectedCreditLoss.compute(exp(120, false, false, 36), P);
        assertThat(r.stage()).isEqualTo(Stage.STAGE_3);
        assertThat(r.horizonPd()).isEqualByComparingTo("1");
        assertThat(r.allowance().minor()).isEqualTo(45_000_000);        // 100% x 45% of 1,000,000.00
    }

    @Test
    void portfolioTotalAddsTheAllowances() {
        List<ExpectedCreditLoss.Result> rs = List.of(ExpectedCreditLoss.compute(exp(0, false, false, 36), P),
                ExpectedCreditLoss.compute(exp(120, false, false, 36), P));
        assertThat(ExpectedCreditLoss.total(rs, thb(0)).minor()).isEqualTo(rs.get(0).allowance().minor() + 45_000_000);
        assertThat(ExpectedCreditLoss.total(List.of(), thb(0)).isZero()).isTrue();
    }

    @Test
    void invalidInputsAreRefused() {
        BigDecimal zero = BigDecimal.ZERO;
        assertThatThrownBy(() -> new Exposure(thb(-1), 0, false, false, 12, zero)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Exposure(thb(1), -1, false, false, 12, zero)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Exposure(thb(1), 0, false, false, 0, zero)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Exposure(thb(1), 0, false, false, 12, new BigDecimal("-0.1")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Parameters.of("1.1", "0.5")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Parameters.of("-0.1", "0.5")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Parameters.of("0.1", "1.5")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Parameters.of("0.1", "-0.5")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Parameters(new BigDecimal("0.1"), new BigDecimal("0.5"), 0, 90))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Parameters(new BigDecimal("0.1"), new BigDecimal("0.5"), 90, 90))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
