package org.fabor.engine.schedule;

import java.time.LocalDate;

public enum Frequency {
    WEEKLY(52), BI_WEEKLY(26), MONTHLY(12), QUARTERLY(4), SEMI_ANNUAL(2), ANNUAL(1);

    private final int perYear;

    Frequency(int perYear) {
        this.perYear = perYear;
    }

    public int perYear() {
        return perYear;
    }

    /** The k-th date after {@code anchor}, always computed from the anchor so month-ends do not drift. */
    public LocalDate nth(LocalDate anchor, int k) {
        return switch (this) {
            case WEEKLY -> anchor.plusWeeks(k);
            case BI_WEEKLY -> anchor.plusWeeks(2L * k);
            case MONTHLY -> anchor.plusMonths(k);
            case QUARTERLY -> anchor.plusMonths(3L * k);
            case SEMI_ANNUAL -> anchor.plusMonths(6L * k);
            case ANNUAL -> anchor.plusYears(k);
        };
    }

    /** Months in one period, or -1 for week-based frequencies. */
    public int months() {
        return switch (this) {
            case MONTHLY -> 1;
            case QUARTERLY -> 3;
            case SEMI_ANNUAL -> 6;
            case ANNUAL -> 12;
            default -> -1;
        };
    }
}
