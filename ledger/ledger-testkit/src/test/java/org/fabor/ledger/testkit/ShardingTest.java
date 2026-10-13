package org.fabor.ledger.testkit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.fabor.ledger.application.CrossShardBatchException;
import org.fabor.ledger.application.CrossShardTransfers;
import org.fabor.ledger.application.CrossShardTransfers.State;
import org.fabor.ledger.application.InsufficientFundsException;
import org.fabor.ledger.application.InvalidReversalException;
import org.fabor.ledger.application.LedgerStore;
import org.fabor.ledger.application.ShardDirectory;
import org.fabor.ledger.application.ShardedLedgerStore;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.ledger.domain.Direction;
import org.fabor.ledger.domain.Entry;
import org.fabor.ledger.domain.PostingBatch;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.IdempotencyKey;
import org.fabor.platform.tenancy.TenantId;
import org.junit.jupiter.api.Test;

class ShardingTest {
    private static final TenantId T = new TenantId("bank-a");
    private static final LocalDate D = LocalDate.of(2026, 1, 1);
    private static final Instant NOW = Instant.parse("2026-01-05T00:00:00Z");

    private final List<InMemoryLedgerStore> shards = new ArrayList<>();
    private final ShardedLedgerStore store = build(4);

    private ShardedLedgerStore build(int n) {
        List<LedgerStore> l = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            InMemoryLedgerStore s = new InMemoryLedgerStore();
            shards.add(s);
            l.add(s);
        }
        return new ShardedLedgerStore(l, ShardDirectory.hashed(n));
    }

    private AccountId onShard(int shard, String prefix) {
        for (int i = 0; ; i++) {
            AccountId a = new AccountId(prefix + i);
            if (store.shardOf(T, a) == shard) {
                return a;
            }
        }
    }

    private static Money thb(long m) {
        return Money.ofMinor(m, Currency.THB);
    }

    private long bal(AccountId a) {
        return store.currentBalance(T, a, BalanceType.SETTLED, Currency.THB).minor();
    }

    private void fund(AccountId a, long minor) {
        AccountId cash = new AccountId("cash@" + a.value());
        store.append(PostingBatch.of(T, new BatchId("fund-" + a.value()), new IdempotencyKey("fund-" + a.value()), D,
                List.of(new Entry(cash, BalanceType.SETTLED, Direction.DEBIT, thb(minor)),
                        new Entry(a, BalanceType.SETTLED, Direction.CREDIT, thb(minor)))), NOW);
    }

    private CrossShardTransfers xfer() {
        return new CrossShardTransfers(store, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void placementKeyKeepsRelatedAccountsTogether() {
        assertThat(ShardDirectory.placementKey(new AccountId("fee@contract-9"))).isEqualTo("contract-9");
        assertThat(store.shardOf(T, new AccountId("fee@contract-9"))).isEqualTo(store.shardOf(T, new AccountId("contract-9")));
        assertThatThrownBy(() -> ShardDirectory.hashed(0)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void singleShardBatchRoutesToOwningShardOnly() {
        AccountId a = onShard(2, "acc");
        fund(a, 500);
        assertThat(bal(a)).isEqualTo(500);
        assertThat(shards.get(2).currentBalance(T, a, BalanceType.SETTLED, Currency.THB).minor()).isEqualTo(500);
        assertThat(store.find(T, new BatchId("fund-" + a.value()))).isPresent();
        assertThat(store.find(T, new BatchId("nope"))).isEmpty();
        assertThat(store.balance(T, a, BalanceType.SETTLED, Currency.THB, D, NOW).minor()).isEqualTo(500);
    }

    @Test
    void crossShardBatchIsRejected() {
        AccountId a = onShard(0, "acc");
        AccountId b = onShard(1, "acc");
        PostingBatch batch = PostingBatch.of(T, new BatchId("x"), new IdempotencyKey("x"), D,
                List.of(new Entry(a, BalanceType.SETTLED, Direction.DEBIT, thb(1)),
                        new Entry(b, BalanceType.SETTLED, Direction.CREDIT, thb(1))));
        assertThatThrownBy(() -> store.append(batch, NOW)).isInstanceOf(CrossShardBatchException.class);
    }

    @Test
    void shardCountMustMatchDirectory() {
        assertThatThrownBy(() -> new ShardedLedgerStore(List.of(new InMemoryLedgerStore()), ShardDirectory.hashed(2)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void crossShardTransferMovesMoneyAndClearingNetsToZero() {
        AccountId from = onShard(0, "from");
        AccountId to = onShard(3, "to");
        fund(from, 1000);
        assertThat(xfer().transfer(T, "t1", from, to, thb(400), D)).isEqualTo(State.COMPLETED);
        assertThat(bal(from)).isEqualTo(600);
        assertThat(bal(to)).isEqualTo(400);
        long clearing = bal(CrossShardTransfers.clearing(from)) + bal(CrossShardTransfers.clearing(to));
        assertThat(clearing).isZero();
        // retry is a no-op
        assertThat(xfer().transfer(T, "t1", from, to, thb(400), D)).isEqualTo(State.COMPLETED);
        assertThat(bal(from)).isEqualTo(600);
        assertThat(bal(to)).isEqualTo(400);
    }

    @Test
    void insufficientFundsLeavesNothingBehind() {
        AccountId from = onShard(0, "from");
        AccountId to = onShard(1, "to");
        fund(from, 100);
        assertThatThrownBy(() -> xfer().transfer(T, "t2", from, to, thb(400), D))
                .isInstanceOf(InsufficientFundsException.class);
        assertThat(xfer().state(T, "t2")).isEqualTo(State.NONE);
        assertThat(bal(from)).isEqualTo(100);
    }

    @Test
    void halfFinishedTransferResumesAndCanBeCancelled() {
        AccountId from = onShard(0, "from");
        AccountId to = onShard(1, "to");
        fund(from, 1000);
        // simulate a crash after the reserve step: run it by hand
        store.append(PostingBatch.of(T, new BatchId("xfer-t3-reserve"), new IdempotencyKey("xfer-t3-reserve"), D, List.of(
                Entry.guardedDebit(from, BalanceType.SETTLED, thb(300)),
                new Entry(CrossShardTransfers.clearing(from), BalanceType.SETTLED, Direction.CREDIT, thb(300)))), NOW);
        assertThat(xfer().state(T, "t3")).isEqualTo(State.RESERVED);
        assertThat(xfer().transfer(T, "t3", from, to, thb(300), D)).isEqualTo(State.COMPLETED);
        assertThat(bal(to)).isEqualTo(300);
        assertThat(bal(from)).isEqualTo(700);

        // second transfer: reserve, then cancel
        AccountId to2 = onShard(2, "to");
        store.append(PostingBatch.of(T, new BatchId("xfer-t4-reserve"), new IdempotencyKey("xfer-t4-reserve"), D, List.of(
                Entry.guardedDebit(from, BalanceType.SETTLED, thb(200)),
                new Entry(CrossShardTransfers.clearing(from), BalanceType.SETTLED, Direction.CREDIT, thb(200)))), NOW);
        assertThat(xfer().cancel(T, "t4", D)).isEqualTo(State.CANCELLED);
        assertThat(bal(from)).isEqualTo(700);
        assertThat(xfer().cancel(T, "t4", D)).isEqualTo(State.CANCELLED);
        assertThat(xfer().transfer(T, "t4", from, to2, thb(200), D)).isEqualTo(State.CANCELLED);
    }

    @Test
    void cancelRulesAndSameShardGuard() {
        AccountId from = onShard(0, "from");
        AccountId to = onShard(1, "to");
        fund(from, 1000);
        assertThatThrownBy(() -> xfer().cancel(T, "unknown", D)).isInstanceOf(InvalidReversalException.class);
        xfer().transfer(T, "t5", from, to, thb(10), D);
        assertThatThrownBy(() -> xfer().cancel(T, "t5", D)).isInstanceOf(InvalidReversalException.class);
        assertThatThrownBy(() -> xfer().transfer(T, "t6", from, onShard(0, "other"), thb(1), D))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
