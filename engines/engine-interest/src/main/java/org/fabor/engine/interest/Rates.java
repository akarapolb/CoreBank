package org.fabor.engine.interest;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import org.fabor.platform.money.Money;
import org.fabor.platform.time.DayCount;
import java.time.LocalDate;

/** Pure rate arithmetic in BigDecimal. No clock, no I/O: same inputs, same outputs. */
public final class Rates {
    public static final MathContext MC = MathContext.DECIMAL128;

    private Rates() { }

    /** (1 + r)^n for integer n >= 0. */
    public static BigDecimal pow(BigDecimal onePlusR, int n) {
        return onePlusR.pow(n, MC);
    }

    /** Simple interest on {@code principal} for the period, rounded to minor units. */
    public static Money simpleInterest(Money principal, BigDecimal annualRate, DayCount dayCount, LocalDate from,
                                       LocalDate to, RoundingMode rounding) {
        return principal.times(annualRate.multiply(dayCount.yearFraction(from, to), MC), rounding);
    }

    /** Periodic rate for nominal annual rate and periods per year. */
    public static BigDecimal periodic(BigDecimal annualRate, int periodsPerYear) {
        return annualRate.divide(BigDecimal.valueOf(periodsPerYear), MC);
    }

    /** Effective annual rate for a periodic rate: (1 + r)^m - 1. */
    public static BigDecimal effectiveAnnual(BigDecimal periodicRate, int periodsPerYear) {
        return pow(BigDecimal.ONE.add(periodicRate), periodsPerYear).subtract(BigDecimal.ONE, MC);
    }

    /**
     * Flat rate to total interest: principal x flat x years, where years = months / 12. The customer-facing
     * way hire purchase is quoted in Thailand.
     */
    public static Money flatInterest(Money principal, BigDecimal flatRate, int termMonths, RoundingMode rounding) {
        return principal.times(flatRate.multiply(BigDecimal.valueOf(termMonths), MC).divide(BigDecimal.valueOf(12), MC),
                rounding);
    }
}
