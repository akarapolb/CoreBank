package org.fabor.engine.interest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.time.DayCount;
import org.junit.jupiter.api.Test;

class InterestTest {
    @Test
    void simpleInterestAct365() {
        Money i = Rates.simpleInterest(Money.ofMinor(1_000_000, Currency.THB), new BigDecimal("0.0365"),
                DayCount.ACT_365F, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 11), RoundingMode.HALF_UP);
        assertThat(i.minor()).isEqualTo(1000); // 10,000.00 x 3.65% x 10/365 = 10.00
    }

    @Test
    void flatInterestIsPrincipalTimesRateTimesYears() {
        // 500,000.00 at 4.25% flat for 60 months = 106,250.00
        assertThat(Rates.flatInterest(Money.ofMinor(50_000_000, Currency.THB), new BigDecimal("0.0425"), 60,
                RoundingMode.HALF_UP).minor()).isEqualTo(10_625_000);
    }

    @Test
    void periodicAndEffective() {
        BigDecimal r = Rates.periodic(new BigDecimal("0.12"), 12);
        assertThat(r).isEqualByComparingTo("0.01");
        assertThat(Rates.effectiveAnnual(r, 12).setScale(8, RoundingMode.HALF_UP)).isEqualByComparingTo("0.12682503");
    }

    @Test
    void eirOfAnnuityRecoversTheRate() {
        // 100,000 over 12 months at 1% per month: payment 8884.88
        List<Long> pays = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            pays.add(888_488L);
        }
        BigDecimal r = Eir.periodicRate(10_000_000L, pays);
        assertThat(r.setScale(6, RoundingMode.HALF_UP)).isEqualByComparingTo("0.010000");
    }

    @Test
    void eirZeroAndErrors() {
        assertThat(Eir.periodicRate(100, List.of(50L, 50L))).isEqualByComparingTo("0");
        assertThatThrownBy(() -> Eir.periodicRate(100, List.of(50L, 40L))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Eir.periodicRate(0, List.of(1L))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Eir.periodicRate(100, List.of())).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void eirOfSteepRateExpandsSearchBound() {
        // pay 300 after one period for 100 advanced: 200% per period
        assertThat(Eir.periodicRate(100, List.of(300L)).setScale(6, RoundingMode.HALF_UP)).isEqualByComparingTo("2.000000");
    }

    @Test
    void eirWithNoSolutionBelowCapFails() {
        assertThatThrownBy(() -> Eir.periodicRate(1, List.of(Long.MAX_VALUE / 4)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
