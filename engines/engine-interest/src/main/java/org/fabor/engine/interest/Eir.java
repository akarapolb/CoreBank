package org.fabor.engine.interest;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Effective interest rate: the periodic rate that discounts all future cash flows to the amount advanced.
 * Solved by bisection in BigDecimal, so the result is deterministic across machines.
 */
public final class Eir {
    private static final BigDecimal TOLERANCE = new BigDecimal("1e-18");

    private Eir() { }

    /**
     * @param advanced     amount paid out at time 0 (minor units, positive)
     * @param payments     payments at periods 1..n (minor units, positive)
     * @return periodic rate r such that sum(payment_k / (1+r)^k) = advanced
     */
    public static BigDecimal periodicRate(long advanced, List<Long> payments) {
        if (advanced <= 0 || payments.isEmpty()) {
            throw new IllegalArgumentException("advanced must be positive and payments non-empty");
        }
        long total = payments.stream().mapToLong(Long::longValue).sum();
        if (total < advanced) {
            throw new IllegalArgumentException("Payments total less than the amount advanced: negative rate");
        }
        if (total == advanced) {
            return BigDecimal.ZERO;
        }
        BigDecimal lo = BigDecimal.ZERO;
        BigDecimal hi = BigDecimal.ONE; // 100% per period
        while (npv(hi, payments).compareTo(BigDecimal.valueOf(advanced)) > 0) {
            hi = hi.multiply(BigDecimal.TWO);
            if (hi.compareTo(BigDecimal.valueOf(1000)) > 0) {
                throw new IllegalArgumentException("No solution below 100000% per period");
            }
        }
        for (int i = 0; i < 200 && hi.subtract(lo).compareTo(TOLERANCE) > 0; i++) {
            BigDecimal mid = lo.add(hi).divide(BigDecimal.TWO, Rates.MC);
            if (npv(mid, payments).compareTo(BigDecimal.valueOf(advanced)) > 0) {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        return lo.add(hi).divide(BigDecimal.TWO, Rates.MC).setScale(16, RoundingMode.HALF_EVEN);
    }

    private static BigDecimal npv(BigDecimal r, List<Long> payments) {
        BigDecimal factor = BigDecimal.ONE.add(r);
        BigDecimal discount = BigDecimal.ONE;
        BigDecimal sum = BigDecimal.ZERO;
        for (long p : payments) {
            discount = discount.multiply(factor, Rates.MC);
            sum = sum.add(BigDecimal.valueOf(p).divide(discount, Rates.MC), Rates.MC);
        }
        return sum;
    }
}
