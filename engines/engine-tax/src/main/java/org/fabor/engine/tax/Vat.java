package org.fabor.engine.tax;

import java.math.BigDecimal;
import java.math.RoundingMode;
import org.fabor.platform.money.Money;

/** VAT arithmetic in minor units. Rounding is half-up per invoice line, as tax invoices are issued per line. */
public final class Vat {
    public record Split(Money base, Money vat, Money gross) { }

    private Vat() { }

    /** Adds VAT to a net amount. */
    public static Split exclusive(Money net, BigDecimal rate) {
        check(rate);
        Money vat = net.times(rate, RoundingMode.HALF_UP);
        return new Split(net, vat, net.plus(vat));
    }

    /** Extracts VAT from a gross amount: vat = gross x rate / (1 + rate). */
    public static Split inclusive(Money gross, BigDecimal rate) {
        check(rate);
        Money vat = gross.times(rate.divide(BigDecimal.ONE.add(rate), java.math.MathContext.DECIMAL128), RoundingMode.HALF_UP);
        return new Split(gross.minus(vat), vat, gross);
    }

    private static void check(BigDecimal rate) {
        if (rate.signum() < 0 || rate.compareTo(new BigDecimal("0.50")) > 0) {
            throw new IllegalArgumentException("VAT rate must be between 0 and 0.50");
        }
    }
}
