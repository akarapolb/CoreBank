package org.fabor.platform.time;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Set;

/** Business-day calendar: weekend days plus an explicit holiday set. Immutable and clock-free. */
public record BusinessCalendar(Set<DayOfWeek> weekend, Set<LocalDate> holidays) {

    public enum Convention { FOLLOWING, MODIFIED_FOLLOWING, PRECEDING }

    public BusinessCalendar {
        weekend = Set.copyOf(weekend);
        holidays = Set.copyOf(holidays);
        if (weekend.size() == 7) {
            throw new IllegalArgumentException("Every day cannot be weekend");
        }
    }

    public static BusinessCalendar monToFri(Set<LocalDate> holidays) {
        return new BusinessCalendar(Set.of(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY), holidays);
    }

    public boolean isBusinessDay(LocalDate date) {
        return !weekend.contains(date.getDayOfWeek()) && !holidays.contains(date);
    }

    public LocalDate adjust(LocalDate date, Convention convention) {
        return switch (convention) {
            case FOLLOWING -> roll(date, 1);
            case PRECEDING -> roll(date, -1);
            case MODIFIED_FOLLOWING -> {
                LocalDate following = roll(date, 1);
                yield following.getMonth() == date.getMonth() ? following : roll(date, -1);
            }
        };
    }

    /** Moves by n business days (negative moves backwards). */
    public LocalDate addBusinessDays(LocalDate date, int n) {
        int step = n < 0 ? -1 : 1;
        LocalDate d = date;
        for (int left = Math.abs(n); left > 0; ) {
            d = d.plusDays(step);
            if (isBusinessDay(d)) {
                left--;
            }
        }
        return d;
    }

    private LocalDate roll(LocalDate date, int step) {
        LocalDate d = date;
        while (!isBusinessDay(d)) {
            d = d.plusDays(step);
        }
        return d;
    }
}
