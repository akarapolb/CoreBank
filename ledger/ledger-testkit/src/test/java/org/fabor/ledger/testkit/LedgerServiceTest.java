package org.fabor.ledger.testkit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.fabor.ledger.application.InvalidReversalException;
import org.fabor.ledger.application.LedgerService;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.platform.money.Currency;
import org.fabor.platform.tenancy.IdempotencyKey;
import org.junit.jupiter.api.Test;

class LedgerServiceTest {
    private final LedgerService svc = new LedgerService(new InMemoryLedgerStore(),
            Clock.fixed(Instant.parse("2026-01-05T00:00:00Z"), ZoneOffset.UTC));

    @Test
    void postReverseAndReadBalance() {
        LocalDate d = LocalDate.of(2026, 1, 1);
        svc.post(LedgerStoreConformance.deposit("b1", "k1", d, 700));
        assertThat(svc.balance(LedgerStoreConformance.T, LedgerStoreConformance.CUSTOMER, BalanceType.SETTLED,
                Currency.THB, d).minor()).isEqualTo(700);
        svc.reverse(LedgerStoreConformance.T, new BatchId("b1"), new BatchId("r1"), new IdempotencyKey("rk"), d);
        assertThat(svc.balance(LedgerStoreConformance.T, LedgerStoreConformance.CUSTOMER, BalanceType.SETTLED,
                Currency.THB, d).minor()).isZero();
    }

    @Test
    void reversingUnknownBatchFails() {
        assertThatThrownBy(() -> svc.reverse(LedgerStoreConformance.T, new BatchId("zz"), new BatchId("r"),
                new IdempotencyKey("rk"), LocalDate.of(2026, 1, 1))).isInstanceOf(InvalidReversalException.class);
    }
}
