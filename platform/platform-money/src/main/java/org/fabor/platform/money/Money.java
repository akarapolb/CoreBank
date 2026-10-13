package org.fabor.platform.money;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Objects;

/**
 * An exact amount of money in minor units (satang, cents). No floating point anywhere.
 * Arithmetic across currencies is rejected; multiplication by a rate requires an explicit rounding mode.
 */
public record Money(long minor, Currency currency) implements Comparable<Money> {

    public Money {
        Objects.requireNonNull(currency, "currency");
    }

    public static Money zero(Currency currency) {
        return new Money(0, currency);
    }

    public static Money ofMinor(long minor, Currency currency) {
        return new Money(minor, currency);
    }

    /** Parses a major-unit decimal; fails if it has more fraction digits than the currency allows. */
    public static Money of(BigDecimal major, Currency currency) {
        BigDecimal scaled = major.setScale(currency.minorUnits(), RoundingMode.UNNECESSARY);
        return new Money(scaled.movePointRight(currency.minorUnits()).longValueExact(), currency);
    }

    public Money plus(Money other) {
        requireSame(other);
        return new Money(Math.addExact(minor, other.minor), currency);
    }

    public Money minus(Money other) {
        requireSame(other);
        return new Money(Math.subtractExact(minor, other.minor), currency);
    }

    public Money negate() {
        return new Money(Math.negateExact(minor), currency);
    }

    /** Multiplies by a decimal factor (rate, share) and rounds explicitly. */
    public Money times(BigDecimal factor, RoundingMode rounding) {
        Objects.requireNonNull(rounding, "rounding");
        BigDecimal result = BigDecimal.valueOf(minor).multiply(factor).setScale(0, rounding);
        return new Money(result.longValueExact(), currency);
    }

    /**
     * Splits into parts proportional to the weights. The parts always sum exactly to this amount;
     * remainder minor units go one each to the earliest parts (deterministic).
     */
    public Money[] allocate(long... weights) {
        if (weights.length == 0) {
            throw new IllegalArgumentException("weights must not be empty");
        }
        long total = 0;
        for (long w : weights) {
            if (w < 0) {
                throw new IllegalArgumentException("weights must be non-negative");
            }
            total = Math.addExact(total, w);
        }
        if (total == 0) {
            throw new IllegalArgumentException("weights must not all be zero");
        }
        long sign = Long.signum(minor);
        long abs = Math.abs(minor);
        Money[] parts = new Money[weights.length];
        long allocated = 0;
        for (int i = 0; i < weights.length; i++) {
            long share = BigDecimal.valueOf(abs).multiply(BigDecimal.valueOf(weights[i]))
                    .divide(BigDecimal.valueOf(total), 0, RoundingMode.DOWN).longValueExact();
            parts[i] = new Money(share, currency);
            allocated += share;
        }
        long remainder = abs - allocated;
        for (int i = 0; remainder > 0; i++) {
            if (weights[i] > 0) {
                parts[i] = new Money(parts[i].minor + 1, currency);
                remainder--;
            }
            if (i == weights.length - 1) {
                i = -1;
            }
        }
        for (int i = 0; i < parts.length; i++) {
            parts[i] = new Money(parts[i].minor * sign, currency);
        }
        return parts;
    }

    public boolean isZero() {
        return minor == 0;
    }

    public boolean isNegative() {
        return minor < 0;
    }

    public BigDecimal toMajor() {
        return BigDecimal.valueOf(minor, currency.minorUnits());
    }

    @Override
    public int compareTo(Money other) {
        requireSame(other);
        return Long.compare(minor, other.minor);
    }

    @Override
    public String toString() {
        return toMajor().toPlainString() + " " + currency.code();
    }

    private void requireSame(Money other) {
        if (!currency.equals(other.currency)) {
            throw new IllegalArgumentException(
                    "Currency mismatch: " + currency.code() + " vs " + other.currency.code());
        }
    }
}
