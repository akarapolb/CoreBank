package org.fabor.platform.time;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class DayCountTest {

    @Test
    void act365() {
        BigDecimal f = DayCount.ACT_365F.yearFraction(LocalDate.of(2026, 1, 1), LocalDate.of(2027, 1, 1));
        assertThat(f).isEqualByComparingTo("1");
    }

    @Test
    void act360() {
        BigDecimal f = DayCount.ACT_360.yearFraction(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 7, 1));
        assertThat(f).isEqualByComparingTo(new BigDecimal("181").divide(new BigDecimal("360"), java.math.MathContext.DECIMAL128));
    }

    @Test
    void thirty360FullYearIsOne() {
        assertThat(DayCount.THIRTY_360.yearFraction(LocalDate.of(2026, 1, 31), LocalDate.of(2027, 1, 31)))
                .isEqualByComparingTo("1");
    }

    @Test
    void thirty360EndOfMonthRule() {
        assertThat(DayCount.THIRTY_360.yearFraction(LocalDate.of(2026, 1, 30), LocalDate.of(2026, 3, 31)))
                .isEqualByComparingTo(new BigDecimal("60").divide(new BigDecimal("360"), java.math.MathContext.DECIMAL128));
    }

    @Test
    void rejectsReversedDates() {
        org.assertj.core.api.Assertions.assertThatThrownBy(
                () -> DayCount.ACT_365F.yearFraction(LocalDate.of(2026, 2, 1), LocalDate.of(2026, 1, 1)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
