package org.fabor.ledger.domain;

import java.util.Objects;
import org.fabor.platform.money.Money;

/**
 * One leg of a batch. The amount is always positive; direction carries the sign.
 * {@code requireFunds} makes the store reject the whole batch if this debit would take the
 * account bucket below zero (checked atomically with the posting).
 */
public record Entry(AccountId account, BalanceType type, Direction direction, Money amount, boolean requireFunds) {

    public Entry(AccountId account, BalanceType type, Direction direction, Money amount) {
        this(account, type, direction, amount, false);
    }

    public Entry {
        Objects.requireNonNull(account, "account");
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(direction, "direction");
        Objects.requireNonNull(amount, "amount");
        if (amount.minor() <= 0) {
            throw new IllegalArgumentException("Entry amount must be positive: " + amount);
        }
        if (requireFunds && direction != Direction.DEBIT) {
            throw new IllegalArgumentException("Only debits can require funds");
        }
    }

    /** A debit that must not overdraw the bucket. */
    public static Entry guardedDebit(AccountId account, BalanceType type, Money amount) {
        return new Entry(account, type, Direction.DEBIT, amount, true);
    }

    /** The mirror leg. Reversals are never guarded: undoing a posting must always succeed. */
    public Entry inverse() {
        return new Entry(account, type, direction.opposite(), amount, false);
    }

    /** Signed effect on a credit-normal balance: credits add, debits subtract. */
    public long signedMinor() {
        return direction == Direction.CREDIT ? amount.minor() : -amount.minor();
    }
}
