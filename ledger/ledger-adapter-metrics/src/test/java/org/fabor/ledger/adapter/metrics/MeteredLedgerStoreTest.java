package org.fabor.ledger.adapter.metrics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.fabor.ledger.application.IdempotencyConflictException;
import org.fabor.ledger.application.InsufficientFundsException;
import org.fabor.ledger.application.InvalidReversalException;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.ledger.domain.Direction;
import org.fabor.ledger.domain.Entry;
import org.fabor.ledger.domain.PostingBatch;
import org.fabor.ledger.testkit.InMemoryLedgerStore;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.IdempotencyKey;
import org.fabor.platform.tenancy.TenantId;
import org.junit.jupiter.api.Test;

class MeteredLedgerStoreTest {
    private static final TenantId T = new TenantId("bank-a");
    private static final LocalDate D = LocalDate.of(2026, 1, 1);
    private final SimpleMeterRegistry reg = new SimpleMeterRegistry();
    private final MeteredLedgerStore store = new MeteredLedgerStore(new InMemoryLedgerStore(), reg);

    private static PostingBatch dep(String id, String key, long m) {
        return PostingBatch.of(T, new BatchId(id), new IdempotencyKey(key), D, List.of(
                new Entry(new AccountId("cash"), BalanceType.SETTLED, Direction.DEBIT, Money.ofMinor(m, Currency.THB)),
                new Entry(new AccountId("c"), BalanceType.SETTLED, Direction.CREDIT, Money.ofMinor(m, Currency.THB))));
    }

    private long count(String outcome) {
        var t = reg.find(MeteredLedgerStore.APPEND).tag("outcome", outcome).timer();
        return t == null ? 0 : t.count();
    }

    @Test
    void recordsOutcomes() {
        PostingBatch b = dep("b1", "k1", 100);
        store.append(b, Instant.now());
        store.append(b, Instant.now());
        assertThatThrownBy(() -> store.append(dep("b2", "k1", 5), Instant.now())).isInstanceOf(IdempotencyConflictException.class);
        assertThatThrownBy(() -> store.append(b.reversal(new BatchId("r"), new IdempotencyKey("rk"), D)
                .reversal(new BatchId("rr"), new IdempotencyKey("rrk"), D), Instant.now()))
                .isInstanceOf(InvalidReversalException.class);
        PostingBatch w = PostingBatch.of(T, new BatchId("w"), new IdempotencyKey("wk"), D, List.of(
                Entry.guardedDebit(new AccountId("c"), BalanceType.SETTLED, Money.ofMinor(999, Currency.THB)),
                new Entry(new AccountId("cash"), BalanceType.SETTLED, Direction.CREDIT, Money.ofMinor(999, Currency.THB))));
        assertThatThrownBy(() -> store.append(w, Instant.now())).isInstanceOf(InsufficientFundsException.class);
        assertThat(count("ok")).isEqualTo(1);
        assertThat(count("replay")).isEqualTo(1);
        assertThat(count("idempotency_conflict")).isEqualTo(1);
        assertThat(count("invalid_reversal")).isEqualTo(1);
        assertThat(count("insufficient_funds")).isEqualTo(1);
    }

    @Test
    void recordsUnexpectedErrorsAndReads() {
        org.fabor.ledger.application.LedgerStore down = (org.fabor.ledger.application.LedgerStore)
                java.lang.reflect.Proxy.newProxyInstance(getClass().getClassLoader(),
                        new Class<?>[] {org.fabor.ledger.application.LedgerStore.class}, (p, m, a) -> {
                            throw new IllegalStateException("db down");
                        });
        var failing = new MeteredLedgerStore(down, reg);
        assertThatThrownBy(() -> failing.append(dep("x", "x", 1), Instant.now())).isInstanceOf(IllegalStateException.class);
        assertThat(count("error")).isEqualTo(1);

        store.find(T, new BatchId("none"));
        store.balance(T, new AccountId("c"), BalanceType.SETTLED, Currency.THB, D, Instant.now());
        store.currentBalance(T, new AccountId("c"), BalanceType.SETTLED, Currency.THB);
        assertThat(reg.find(MeteredLedgerStore.READ).timers()).hasSize(3);
    }
}
