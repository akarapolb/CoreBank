package org.fabor.platform.time;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Set;
import org.fabor.platform.time.BusinessCalendar.Convention;
import org.junit.jupiter.api.Test;

class BusinessCalendarTest {
    // 2026-05-01 Fri holiday (Labour Day); 2026-05-30 Sat; 2026-05-31 Sun
    private final BusinessCalendar cal = BusinessCalendar.monToFri(Set.of(LocalDate.of(2026, 5, 1)));

    @Test
    void businessDayChecks() {
        assertThat(cal.isBusinessDay(LocalDate.of(2026, 5, 1))).isFalse();
        assertThat(cal.isBusinessDay(LocalDate.of(2026, 5, 2))).isFalse();
        assertThat(cal.isBusinessDay(LocalDate.of(2026, 5, 4))).isTrue();
    }

    @Test
    void conventions() {
        LocalDate holiday = LocalDate.of(2026, 5, 1);
        assertThat(cal.adjust(holiday, Convention.FOLLOWING)).isEqualTo(LocalDate.of(2026, 5, 4));
        assertThat(cal.adjust(holiday, Convention.PRECEDING)).isEqualTo(LocalDate.of(2026, 4, 30));
        assertThat(cal.adjust(LocalDate.of(2026, 5, 4), Convention.FOLLOWING)).isEqualTo(LocalDate.of(2026, 5, 4));
        LocalDate sat = LocalDate.of(2026, 5, 30);
        assertThat(cal.adjust(sat, Convention.FOLLOWING)).isEqualTo(LocalDate.of(2026, 6, 1));
        assertThat(cal.adjust(sat, Convention.MODIFIED_FOLLOWING)).isEqualTo(LocalDate.of(2026, 5, 29));
        assertThat(cal.adjust(holiday, Convention.MODIFIED_FOLLOWING)).isEqualTo(LocalDate.of(2026, 5, 4));
    }

    @Test
    void addBusinessDays() {
        assertThat(cal.addBusinessDays(LocalDate.of(2026, 4, 30), 1)).isEqualTo(LocalDate.of(2026, 5, 4));
        assertThat(cal.addBusinessDays(LocalDate.of(2026, 5, 4), -1)).isEqualTo(LocalDate.of(2026, 4, 30));
        assertThat(cal.addBusinessDays(LocalDate.of(2026, 5, 4), 0)).isEqualTo(LocalDate.of(2026, 5, 4));
    }

    @Test
    void rejectsAllWeekend() {
        assertThatThrownBy(() -> new BusinessCalendar(Set.of(DayOfWeek.values()), Set.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
