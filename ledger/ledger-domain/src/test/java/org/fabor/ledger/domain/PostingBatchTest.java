package org.fabor.ledger.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import net.jqwik.api.Arbitraries;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.constraints.LongRange;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.IdempotencyKey;
import org.fabor.platform.tenancy.TenantId;
import org.junit.jupiter.api.Test;

class PostingBatchTest {
    static final TenantId T = new TenantId("bank-a");

    static Entry e(String acct, Direction d, long minor, Currency c) {
        return new Entry(new AccountId(acct), BalanceType.SETTLED, d, Money.ofMinor(minor, c));
    }

    static PostingBatch batch(long amt) {
        return PostingBatch.of(T, new BatchId("b1"), new IdempotencyKey("k1"), LocalDate.of(2026, 1, 1),
                List.of(e("a", Direction.DEBIT, amt, Currency.THB), e("b", Direction.CREDIT, amt, Currency.THB)));
    }

    @Test
    void balancedBatchAccepted() {
        assertThat(batch(100).entries()).hasSize(2);
    }

    @Test
    void unbalancedRejected() {
        assertThatThrownBy(() -> PostingBatch.of(T, new BatchId("b"), new IdempotencyKey("k"), LocalDate.of(2026, 1, 1),
                List.of(e("a", Direction.DEBIT, 100, Currency.THB), e("b", Direction.CREDIT, 99, Currency.THB))))
                .isInstanceOf(UnbalancedBatchException.class);
    }

    @Test
    void balanceIsPerCurrency() {
        assertThatThrownBy(() -> PostingBatch.of(T, new BatchId("b"), new IdempotencyKey("k"), LocalDate.of(2026, 1, 1),
                List.of(e("a", Direction.DEBIT, 100, Currency.THB), e("b", Direction.CREDIT, 100, Currency.USD))))
                .isInstanceOf(UnbalancedBatchException.class);
    }

    @Test
    void needsTwoEntriesAndPositiveAmounts() {
        assertThatThrownBy(() -> PostingBatch.of(T, new BatchId("b"), new IdempotencyKey("k"), LocalDate.of(2026, 1, 1),
                List.of(e("a", Direction.DEBIT, 100, Currency.THB)))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> e("a", Direction.DEBIT, 0, Currency.THB)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void validatesIds() {
        assertThatThrownBy(() -> new AccountId(" ")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new BatchId(null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void reversalMirrorsAndIsBalanced() {
        PostingBatch b = batch(250);
        PostingBatch r = b.reversal(new BatchId("r1"), new IdempotencyKey("rk"), LocalDate.of(2026, 1, 2));
        assertThat(r.reverses()).contains(b.id());
        assertThat(r.entries().get(0).direction()).isEqualTo(Direction.CREDIT);
        assertThat(Direction.CREDIT.opposite()).isEqualTo(Direction.DEBIT);
    }

    @Property
    void anySymmetricBatchBalances(@ForAll @LongRange(min = 1, max = 1_000_000_000_000L) long amt) {
        assertThat(batch(amt)).isNotNull();
    }

    @Test
    void guardedDebitRules() {
        Entry g = Entry.guardedDebit(new AccountId("a"), BalanceType.SETTLED, Money.ofMinor(5, Currency.THB));
        assertThat(g.requireFunds()).isTrue();
        assertThat(g.inverse().requireFunds()).isFalse();
        assertThatThrownBy(() -> new Entry(new AccountId("a"), BalanceType.SETTLED, Direction.CREDIT,
                Money.ofMinor(5, Currency.THB), true)).isInstanceOf(IllegalArgumentException.class);
    }
}
