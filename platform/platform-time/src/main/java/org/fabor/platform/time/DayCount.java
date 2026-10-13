package org.fabor.platform.time;

import java.math.BigDecimal;
import java.math.MathContext;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/** Day-count conventions. Pure functions of their inputs: no clock, no I/O. */
public enum DayCount {
    ACT_365F,
    ACT_360,
    THIRTY_360;

    /** Year fraction between start (inclusive) and end (exclusive). */
    public BigDecimal yearFraction(LocalDate start, LocalDate end) {
        if (end.isBefore(start)) {
            throw new IllegalArgumentException("end before start: " + start + " > " + end);
        }
        return switch (this) {
            case ACT_365F -> frac(ChronoUnit.DAYS.between(start, end), 365);
            case ACT_360 -> frac(ChronoUnit.DAYS.between(start, end), 360);
            case THIRTY_360 -> frac(days30360(start, end), 360);
        };
    }

    private static BigDecimal frac(long days, int basis) {
        return BigDecimal.valueOf(days).divide(BigDecimal.valueOf(basis), MathContext.DECIMAL128);
    }

    /** 30/360 US (bond basis). */
    private static long days30360(LocalDate s, LocalDate e) {
        int d1 = Math.min(s.getDayOfMonth(), 30);
        int d2 = e.getDayOfMonth();
        if (d2 == 31 && d1 == 30) {
            d2 = 30;
        }
        return 360L * (e.getYear() - s.getYear()) + 30L * (e.getMonthValue() - s.getMonthValue()) + (d2 - d1);
    }
}
