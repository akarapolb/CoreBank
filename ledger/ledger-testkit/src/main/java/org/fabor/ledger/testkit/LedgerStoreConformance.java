package org.fabor.ledger.testkit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.ArrayList;
import org.fabor.ledger.application.IdempotencyConflictException;
import org.fabor.ledger.application.InvalidReversalException;
import org.fabor.ledger.application.LedgerStore;
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

/**
 * Behaviour every {@link LedgerStore} must have, whatever the database. Subclass it and return a
 * fresh, empty store from {@link #newStore()}.
 */
public abstract class LedgerStoreConformance {
    protected static final TenantId T = new TenantId("bank-a");
    protected static final AccountId CUSTOMER = new AccountId("cust-1");
    protected static final AccountId CASH = new AccountId("gl-cash");
    protected static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");
    protected static final Instant T1 = Instant.parse("2026-01-02T00:00:00Z");
    protected static final Instant T2 = Instant.parse("2026-01-03T00:00:00Z");

    protected abstract LedgerStore newStore();

    protected static PostingBatch deposit(String id, String key, LocalDate value, long minor) {
        return PostingBatch.of(T, new BatchId(id), new IdempotencyKey(key), value, List.of(
                new Entry(CASH, BalanceType.SETTLED, Direction.DEBIT, Money.ofMinor(minor, Currency.THB)),
                new Entry(CUSTOMER, BalanceType.SETTLED, Direction.CREDIT, Money.ofMinor(minor, Currency.THB))));
    }

    private static Money bal(LedgerStore s, AccountId a, LocalDate v, Instant r) {
        return s.balance(T, a, BalanceType.SETTLED, Currency.THB, v, r);
    }

    @Test
    void postUpdatesBalances() {
        LedgerStore s = newStore();
        s.append(deposit("b1", "k1", LocalDate.of(2026, 1, 1), 1000), T0);
        assertThat(bal(s, CUSTOMER, LocalDate.of(2026, 1, 1), T0).minor()).isEqualTo(1000);
        assertThat(bal(s, CASH, LocalDate.of(2026, 1, 1), T0).minor()).isEqualTo(-1000);
    }

    @Test
    void sameKeySameContentReplays() {
        LedgerStore s = newStore();
        PostingBatch b = deposit("b1", "k1", LocalDate.of(2026, 1, 1), 1000);
        assertThat(s.append(b, T0).replayed()).isFalse();
        LedgerStore.PostResult again = s.append(b, T1);
        assertThat(again.replayed()).isTrue();
        assertThat(again.stored().recordedAt()).isEqualTo(T0);
        assertThat(bal(s, CUSTOMER, LocalDate.of(2026, 1, 1), T2).minor()).isEqualTo(1000);
    }

    @Test
    void sameKeyDifferentContentConflicts() {
        LedgerStore s = newStore();
        s.append(deposit("b1", "k1", LocalDate.of(2026, 1, 1), 1000), T0);
        assertThatThrownBy(() -> s.append(deposit("b2", "k1", LocalDate.of(2026, 1, 1), 999), T0))
                .isInstanceOf(IdempotencyConflictException.class);
    }

    @Test
    void duplicateBatchIdWithNewKeyConflicts() {
        LedgerStore s = newStore();
        s.append(deposit("b1", "k1", LocalDate.of(2026, 1, 1), 1000), T0);
        assertThatThrownBy(() -> s.append(deposit("b1", "k2", LocalDate.of(2026, 1, 1), 1000), T0))
                .isInstanceOf(IdempotencyConflictException.class);
    }

    @Test
    void bitemporalAsOfQueries() {
        LedgerStore s = newStore();
        s.append(deposit("b1", "k1", LocalDate.of(2026, 1, 1), 1000), T0);
        // back-dated: effective 1 Jan but only recorded on 3 Jan
        s.append(deposit("b2", "k2", LocalDate.of(2026, 1, 1), 500), T2);
        assertThat(bal(s, CUSTOMER, LocalDate.of(2026, 1, 1), T1).minor()).isEqualTo(1000);
        assertThat(bal(s, CUSTOMER, LocalDate.of(2026, 1, 1), T2).minor()).isEqualTo(1500);
        // future-dated entry is invisible before its value date
        s.append(deposit("b3", "k3", LocalDate.of(2026, 2, 1), 200), T0);
        assertThat(bal(s, CUSTOMER, LocalDate.of(2026, 1, 31), T2).minor()).isEqualTo(1500);
        assertThat(bal(s, CUSTOMER, LocalDate.of(2026, 2, 1), T2).minor()).isEqualTo(1700);
    }

    @Test
    void balanceTypesAndTenantsAreIsolated() {
        LedgerStore s = newStore();
        s.append(deposit("b1", "k1", LocalDate.of(2026, 1, 1), 1000), T0);
        assertThat(s.balance(T, CUSTOMER, BalanceType.HOLD, Currency.THB, LocalDate.of(2026, 1, 1), T0).minor()).isZero();
        assertThat(s.balance(new TenantId("bank-b"), CUSTOMER, BalanceType.SETTLED, Currency.THB,
                LocalDate.of(2026, 1, 1), T0).minor()).isZero();
        assertThat(s.balance(T, CUSTOMER, BalanceType.SETTLED, Currency.USD, LocalDate.of(2026, 1, 1), T0).minor()).isZero();
    }

    @Test
    void reversalCancelsOriginalOnce() {
        LedgerStore s = newStore();
        PostingBatch b = deposit("b1", "k1", LocalDate.of(2026, 1, 1), 1000);
        s.append(b, T0);
        PostingBatch r = b.reversal(new BatchId("r1"), new IdempotencyKey("rk1"), LocalDate.of(2026, 1, 2));
        s.append(r, T1);
        assertThat(bal(s, CUSTOMER, LocalDate.of(2026, 1, 2), T1).minor()).isZero();
        PostingBatch again = b.reversal(new BatchId("r2"), new IdempotencyKey("rk2"), LocalDate.of(2026, 1, 3));
        assertThatThrownBy(() -> s.append(again, T2)).isInstanceOf(InvalidReversalException.class);
        PostingBatch reverseOfReverse = r.reversal(new BatchId("r3"), new IdempotencyKey("rk3"), LocalDate.of(2026, 1, 3));
        assertThatThrownBy(() -> s.append(reverseOfReverse, T2)).isInstanceOf(InvalidReversalException.class);
    }

    @Test
    void reversalOfUnknownBatchRejected() {
        LedgerStore s = newStore();
        PostingBatch ghost = deposit("ghost", "kg", LocalDate.of(2026, 1, 1), 1)
                .reversal(new BatchId("r1"), new IdempotencyKey("rk"), LocalDate.of(2026, 1, 2));
        assertThatThrownBy(() -> s.append(ghost, T0)).isInstanceOf(InvalidReversalException.class);
    }

    @Test
    void findReturnsStoredBatch() {
        LedgerStore s = newStore();
        s.append(deposit("b1", "k1", LocalDate.of(2026, 1, 1), 1000), T0);
        assertThat(s.find(T, new BatchId("b1"))).isPresent();
        assertThat(s.find(T, new BatchId("nope"))).isEmpty();
    }

    @Test
    void concurrentRetriesOfOneKeyPostOnce() throws Exception {
        LedgerStore s = newStore();
        PostingBatch b = deposit("b1", "k1", LocalDate.of(2026, 1, 1), 1000);
        ExecutorService pool = Executors.newFixedThreadPool(8);
        try {
            List<Future<LedgerStore.PostResult>> fs = new ArrayList<>();
            for (int i = 0; i < 32; i++) {
                fs.add(pool.submit(() -> s.append(b, T0)));
            }
            long firsts = 0;
            for (Future<LedgerStore.PostResult> f : fs) {
                if (!f.get(10, TimeUnit.SECONDS).replayed()) {
                    firsts++;
                }
            }
            assertThat(firsts).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
        assertThat(bal(s, CUSTOMER, LocalDate.of(2026, 1, 1), T0).minor()).isEqualTo(1000);
    }

    @Test
    void concurrentPostsKeepTheBooksBalanced() throws Exception {
        LedgerStore s = newStore();
        ExecutorService pool = Executors.newFixedThreadPool(8);
        try {
            List<Future<?>> fs = new ArrayList<>();
            for (int i = 0; i < 200; i++) {
                int n = i;
                fs.add(pool.submit(() -> s.append(deposit("b" + n, "k" + n, LocalDate.of(2026, 1, 1), 10), T0)));
            }
            for (Future<?> f : fs) {
                f.get(10, TimeUnit.SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }
        long cust = bal(s, CUSTOMER, LocalDate.of(2026, 1, 1), T0).minor();
        long cash = bal(s, CASH, LocalDate.of(2026, 1, 1), T0).minor();
        assertThat(cust).isEqualTo(2000);
        assertThat(cust + cash).isZero();
    }
}
