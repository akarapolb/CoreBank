package org.fabor.ledger.application;

import java.time.Clock;
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
 * Reserve → commit transfer between accounts on different shards (ADR-0008, ADR-0010).
 *
 * <pre>
 *   shard A:  debit  from (funds checked)      credit xfer-clearing@from     (reserve)
 *   shard B:  debit  xfer-clearing@to          credit to                     (commit)
 * </pre>
 *
 * Each step is a balanced, idempotent batch with ids derived from the transfer id, so calling
 * {@link #transfer} again resumes a half-finished transfer. {@link #cancel} undoes a reserve that was
 * never committed. One orchestrator (a workflow) must drive a given transfer: cancel and commit are
 * not safe to run concurrently against the same transfer.
 */
public final class CrossShardTransfers {
    public enum State { NONE, RESERVED, COMPLETED, CANCELLED }

    private final ShardedLedgerStore store;
    private final Clock clock;

    public CrossShardTransfers(ShardedLedgerStore store, Clock clock) {
        this.store = store;
        this.clock = clock;
    }

    public State transfer(TenantId tenant, String transferId, AccountId from, AccountId to, Money amount,
                          LocalDate valueDate) {
        if (store.shardOf(tenant, from) == store.shardOf(tenant, to)) {
            throw new IllegalArgumentException("Same shard: post a normal batch instead");
        }
        State s = state(tenant, transferId);
        if (s == State.COMPLETED || s == State.CANCELLED) {
            return s;
        }
        if (s == State.NONE) {
            store.append(PostingBatch.of(tenant, reserveId(transferId), key(transferId, "reserve"), valueDate, List.of(
                    Entry.guardedDebit(from, BalanceType.SETTLED, amount),
                    new Entry(clearing(from), BalanceType.SETTLED, Direction.CREDIT, amount))), clock.instant());
        }
        store.append(PostingBatch.of(tenant, commitId(transferId), key(transferId, "commit"), valueDate, List.of(
                new Entry(clearing(to), BalanceType.SETTLED, Direction.DEBIT, amount),
                new Entry(to, BalanceType.SETTLED, Direction.CREDIT, amount))), clock.instant());
        return State.COMPLETED;
    }

    /** Releases a reserved transfer. Fails if it was already committed. */
    public State cancel(TenantId tenant, String transferId, LocalDate valueDate) {
        State s = state(tenant, transferId);
        switch (s) {
            case NONE -> throw new InvalidReversalException("Unknown transfer " + transferId);
            case COMPLETED -> throw new InvalidReversalException("Transfer already committed: " + transferId);
            case CANCELLED -> { return s; }
            default -> { }
        }
        PostingBatch reserve = store.find(tenant, reserveId(transferId)).orElseThrow().batch();
        store.append(reserve.reversal(cancelId(transferId), key(transferId, "cancel"), valueDate), clock.instant());
        return State.CANCELLED;
    }

    public State state(TenantId tenant, String transferId) {
        if (store.find(tenant, commitId(transferId)).isPresent()) {
            return State.COMPLETED;
        }
        if (store.find(tenant, cancelId(transferId)).isPresent()) {
            return State.CANCELLED;
        }
        return store.find(tenant, reserveId(transferId)).isPresent() ? State.RESERVED : State.NONE;
    }

    /** Clearing account co-located with {@code account}'s shard. */
    public static AccountId clearing(AccountId account) {
        return new AccountId("xfer-clearing@" + ShardDirectory.placementKey(account));
    }

    private static BatchId reserveId(String id) {
        return new BatchId("xfer-" + id + "-reserve");
    }

    private static BatchId commitId(String id) {
        return new BatchId("xfer-" + id + "-commit");
    }

    private static BatchId cancelId(String id) {
        return new BatchId("xfer-" + id + "-cancel");
    }

    private static IdempotencyKey key(String id, String step) {
        return new IdempotencyKey("xfer-" + id + "-" + step);
    }
}
