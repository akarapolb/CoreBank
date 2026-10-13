package org.fabor.ledger.application;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.TreeSet;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.ledger.domain.Entry;
import org.fabor.ledger.domain.PostingBatch;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.TenantId;

/**
 * Application-level sharding. A batch runs as one local transaction on one shard, so every entry
 * must map to the same shard; anything else is a {@link CrossShardBatchException} and goes through
 * {@link CrossShardTransfers}. Idempotency keys and batch ids are unique per shard: callers must
 * not reuse one key for batches that route differently (the gateway assigns keys per request).
 */
public final class ShardedLedgerStore implements LedgerStore {
    private final List<LedgerStore> shards;
    private final ShardDirectory directory;

    public ShardedLedgerStore(List<LedgerStore> shards, ShardDirectory directory) {
        if (shards.size() != directory.shardCount()) {
            throw new IllegalArgumentException("Directory has " + directory.shardCount() + " shards, got " + shards.size());
        }
        this.shards = List.copyOf(shards);
        this.directory = directory;
    }

    public int shardOf(TenantId tenant, AccountId account) {
        return directory.shardOf(tenant, account);
    }

    @Override
    public PostResult append(PostingBatch batch, Instant recordedAt) {
        TreeSet<Integer> used = new TreeSet<>();
        for (Entry e : batch.entries()) {
            used.add(directory.shardOf(batch.tenant(), e.account()));
        }
        if (used.size() != 1) {
            throw new CrossShardBatchException("Batch " + batch.id().value() + " spans shards " + used
                    + "; use a cross-shard transfer");
        }
        return shards.get(used.first()).append(batch, recordedAt);
    }

    @Override
    public Optional<StoredBatch> find(TenantId tenant, BatchId id) {
        for (LedgerStore s : shards) {
            Optional<StoredBatch> r = s.find(tenant, id);
            if (r.isPresent()) {
                return r;
            }
        }
        return Optional.empty();
    }

    @Override
    public Money balance(TenantId tenant, AccountId account, BalanceType type, Currency currency,
                         LocalDate valueAsOf, Instant recordedAsOf) {
        return shards.get(directory.shardOf(tenant, account)).balance(tenant, account, type, currency, valueAsOf,
                recordedAsOf);
    }

    @Override
    public Money currentBalance(TenantId tenant, AccountId account, BalanceType type, Currency currency) {
        return shards.get(directory.shardOf(tenant, account)).currentBalance(tenant, account, type, currency);
    }

    @Override
    public List<EntryRecord> entries(TenantId tenant, AccountId account, BalanceType type, Currency currency, LocalDate asOf,
                                     int limit) {
        return shards.get(directory.shardOf(tenant, account)).entries(tenant, account, type, currency, asOf, limit);
    }

    @Override
    public List<AccountId> accounts(TenantId tenant) {
        java.util.Set<AccountId> out = new java.util.TreeSet<>(java.util.Comparator.comparing(AccountId::value));
        for (LedgerStore s : shards) {
            out.addAll(s.accounts(tenant));
        }
        return List.copyOf(out);
    }
}
