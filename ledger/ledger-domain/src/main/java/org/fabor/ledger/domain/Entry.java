package org.fabor.ledger.domain;

import java.util.Objects;
import org.fabor.platform.money.Money;

/** One leg of a batch. The amount is always positive; direction carries the sign. */
public record Entry(AccountId account, BalanceType type, Direction direction, Money amount) {
    public Entry {
        Objects.requireNonNull(account, "account");
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(direction, "direction");
        Objects.requireNonNull(amount, "amount");
        if (amount.minor() <= 0) {
            throw new IllegalArgumentException("Entry amount must be positive: " + amount);
        }
    }

    public Entry inverse() {
        return new Entry(account, type, direction.opposite(), amount);
    }

    /** Signed effect on a credit-normal balance: credits add, debits subtract. */
    public long signedMinor() {
        return direction == Direction.CREDIT ? amount.minor() : -amount.minor();
    }
}
