package org.fabor.engine.schedule;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Objects;
import org.fabor.platform.money.Money;
import org.fabor.platform.time.BusinessCalendar;
import org.fabor.platform.time.BusinessCalendar.Convention;

/**
 * Inputs of a repayment schedule. {@code annualRate} is the nominal annual rate for ANNUITY,
 * EQUAL_PRINCIPAL and BULLET, and the quoted flat rate (per year) for ANNUITY_FROM_FLAT.
 * {@code firstDue} may be null: one period after disbursement.
 */
public record ScheduleRequest(Money principal, BigDecimal annualRate, int periods, Frequency frequency,
                              LocalDate disbursement, LocalDate firstDue, Method method, Money balloon,
                              int interestOnlyPeriods, BusinessCalendar calendar, Convention convention,
                              RoundingMode rounding) {

    public ScheduleRequest {
        Objects.requireNonNull(principal, "principal");
        Objects.requireNonNull(annualRate, "annualRate");
        Objects.requireNonNull(frequency, "frequency");
        Objects.requireNonNull(disbursement, "disbursement");
        Objects.requireNonNull(method, "method");
        Objects.requireNonNull(calendar, "calendar");
        Objects.requireNonNull(convention, "convention");
        Objects.requireNonNull(rounding, "rounding");
        if (balloon == null) {
            balloon = Money.zero(principal.currency());
        }
        if (principal.minor() <= 0) {
            throw new IllegalArgumentException("principal must be positive");
        }
        if (annualRate.signum() < 0) {
            throw new IllegalArgumentException("rate must not be negative");
        }
        if (periods < 1 || periods > 1200) {
            throw new IllegalArgumentException("periods must be 1..1200");
        }
        if (!balloon.currency().equals(principal.currency()) || balloon.isNegative()
                || balloon.minor() >= principal.minor()) {
            throw new IllegalArgumentException("balloon must be in the same currency, >= 0 and below the principal");
        }
        if (interestOnlyPeriods < 0 || interestOnlyPeriods >= periods) {
            throw new IllegalArgumentException("interestOnlyPeriods must be 0..periods-1");
        }
        if (firstDue != null && !firstDue.isAfter(disbursement)) {
            throw new IllegalArgumentException("firstDue must be after disbursement");
        }
    }
}
