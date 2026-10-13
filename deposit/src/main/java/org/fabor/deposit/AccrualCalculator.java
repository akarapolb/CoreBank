package org.fabor.deposit;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import org.fabor.engine.product.ProductDefinition.Deposit;
import org.fabor.engine.product.ProductDefinition.Tier;
import org.fabor.engine.product.ProductDefinition.TierMode;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;

/**
 * Accrued interest as a pure function of the end-of-day balance history and the product's tiers (ADR-0007):
 * no stored accrual postings are needed to know what a customer has earned so far. Sums exactly in BigDecimal
 * and rounds once, half-up, at the end.
 */
public final class AccrualCalculator {
    public record DayBalance(LocalDate day, long minor) { }

    private AccrualCalculator() { }

    public static Money accrue(List<DayBalance> days, Deposit rule, Currency currency, int dayBasis) {
        BigDecimal total = BigDecimal.ZERO;
        BigDecimal unit = BigDecimal.TEN.pow(currency.minorUnits());
        for (DayBalance d : days) {
            if (d.minor() <= 0) {
                continue;
            }
            BigDecimal major = BigDecimal.valueOf(d.minor()).divide(unit, MathContext.DECIMAL128);
            total = total.add(dailyInterestMajor(major, rule), MathContext.DECIMAL128);
        }
        BigDecimal minor = total.multiply(unit, MathContext.DECIMAL128).divide(BigDecimal.valueOf(dayBasis), MathContext.DECIMAL128);
        return Money.ofMinor(minor.setScale(0, RoundingMode.HALF_UP).longValueExact(), currency);
    }

    /** Balance (major units) times rate for one day, before dividing by the day basis. */
    private static BigDecimal dailyInterestMajor(BigDecimal balance, Deposit rule) {
        List<Tier> tiers = rule.tiers();
        if (rule.tierMode() == TierMode.MARGINAL) {
            BigDecimal sum = BigDecimal.ZERO;
            BigDecimal lower = BigDecimal.ZERO;
            for (Tier t : tiers) {
                BigDecimal upper = t.upTo() == null ? balance : t.upTo().min(balance);
                if (upper.compareTo(lower) > 0) {
                    sum = sum.add(upper.subtract(lower).multiply(t.rate(), MathContext.DECIMAL128), MathContext.DECIMAL128);
                }
                if (t.upTo() == null || balance.compareTo(t.upTo()) <= 0) {
                    break;
                }
                lower = t.upTo();
            }
            return sum;
        }
        for (Tier t : tiers) {
            if (t.upTo() == null || balance.compareTo(t.upTo()) <= 0) {
                return balance.multiply(t.rate(), MathContext.DECIMAL128);
            }
        }
        return BigDecimal.ZERO;
    }
}
