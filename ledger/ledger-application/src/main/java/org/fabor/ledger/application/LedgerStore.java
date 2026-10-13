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
     * Same key with different content is a {@link IdempotencyConflictException}. A batch with a
     * {@code requireFunds} entry that would overdraw is rejected with {@link InsufficientFundsException}. A batch may be
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

    /**
     * Balance of one bucket over everything committed so far, regardless of value date. This is the
     * figure {@code requireFunds} entries are checked against; stores keep it in a maintained table.
     */
    Money currentBalance(TenantId tenant, AccountId account, BalanceType type, Currency currency);

    /** Every account that has at least one entry. Used by reconciliation, not on the posting path. */
    java.util.List<AccountId> accounts(TenantId tenant);

    /**
     * Newest-first entries of one account bucket, for statements and activity lists. Entries with value date after
     * {@code asOf} are not included. At most {@code limit} rows (1 to 500).
     */
    java.util.List<EntryRecord> entries(TenantId tenant, AccountId account, BalanceType type, Currency currency,
                                        LocalDate asOf, int limit);

    /** One entry as seen from its account: direction relative to that account and the batch it belongs to. */
    record EntryRecord(BatchId batchId, LocalDate valueDate, Instant recordedAt, org.fabor.ledger.domain.Direction direction,
                       Money amount) { }

    record StoredBatch(PostingBatch batch, Instant recordedAt) { }

    record PostResult(StoredBatch stored, boolean replayed) { }
}
