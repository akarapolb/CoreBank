package org.fabor.ledger.application;

import java.time.LocalDate;
import java.util.List;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.ledger.domain.Direction;
import org.fabor.ledger.domain.Entry;
import org.fabor.ledger.domain.PostingBatch;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.IdempotencyKey;
import org.fabor.platform.tenancy.TenantId;

/**
 * Holds are ordinary balanced batches that move value between the SETTLED and HOLD buckets of one
 * account, so they inherit idempotency, bitemporality and audit. Release is a reversal of the hold
 * batch ({@link LedgerService#reverse}); capture turns the hold into a payment.
 */
public final class Holds {
    private Holds() { }

    /** SETTLED to HOLD on the same account. */
    public static PostingBatch place(TenantId tenant, BatchId id, IdempotencyKey key, LocalDate valueDate,
                                     AccountId account, Money amount) {
        return PostingBatch.of(tenant, id, key, valueDate, List.of(
                new Entry(account, BalanceType.SETTLED, Direction.DEBIT, amount),
                new Entry(account, BalanceType.HOLD, Direction.CREDIT, amount)));
    }

    /** Consumes the hold on {@code from} and credits {@code to} (SETTLED). */
    public static PostingBatch capture(TenantId tenant, BatchId id, IdempotencyKey key, LocalDate valueDate,
                                       AccountId from, AccountId to, Money amount) {
        return PostingBatch.of(tenant, id, key, valueDate, List.of(
                new Entry(from, BalanceType.HOLD, Direction.DEBIT, amount),
                new Entry(to, BalanceType.SETTLED, Direction.CREDIT, amount)));
    }
}
