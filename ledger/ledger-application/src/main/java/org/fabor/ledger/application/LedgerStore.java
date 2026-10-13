package org.fabor.ledger.application;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.ledger.domain.PostingBatch;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.TenantId;

/**
 * Persistence port, one implementation per database. Every implementation must pass the
 * shared conformance suite in {@code ledger-testkit}.
 */
public interface LedgerStore {

    /**
     * Atomically stores the batch, or returns the earlier result when the idempotency key was seen.
     * Same key with different content is a {@link IdempotencyConflictException}. A batch may be
     * reversed at most once, and a reversal cannot itself be reversed.
     */
    PostResult append(PostingBatch batch, Instant recordedAt);

    Optional<StoredBatch> find(TenantId tenant, BatchId id);

    /**
     * Credit-normal balance of one account bucket, including batches with value date on or before
     * {@code valueAsOf} that were recorded at or before {@code recordedAsOf}.
     */
    Money balance(TenantId tenant, AccountId account, BalanceType type, Currency currency,
                  LocalDate valueAsOf, Instant recordedAsOf);

    record StoredBatch(PostingBatch batch, Instant recordedAt) { }

    record PostResult(StoredBatch stored, boolean replayed) { }
}
