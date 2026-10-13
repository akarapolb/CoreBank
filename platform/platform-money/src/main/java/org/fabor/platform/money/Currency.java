package org.fabor.platform.money;

import java.util.Objects;

/** ISO 4217 currency with its number of minor-unit digits. */
public record Currency(String code, int minorUnits) {

    public static final Currency THB = new Currency("THB", 2);
    public static final Currency USD = new Currency("USD", 2);
    public static final Currency EUR = new Currency("EUR", 2);
    public static final Currency JPY = new Currency("JPY", 0);
    public static final Currency KWD = new Currency("KWD", 3);

    public Currency {
        Objects.requireNonNull(code, "code");
        if (!code.matches("[A-Z]{3}")) {
            throw new IllegalArgumentException("Currency code must be 3 upper-case letters: " + code);
        }
        if (minorUnits < 0 || minorUnits > 4) {
            throw new IllegalArgumentException("minorUnits must be 0..4: " + minorUnits);
        }
    }
}
