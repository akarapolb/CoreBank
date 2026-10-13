package org.fabor.ledger.testkit;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.fabor.ledger.application.Holds;
import org.fabor.ledger.application.LedgerService;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.IdempotencyKey;
import org.junit.jupiter.api.Test;

class HoldsTest {
    private static final LocalDate D = LocalDate.of(2026, 1, 1);
    private static final AccountId MERCHANT = new AccountId("merchant-1");
    private final LedgerService svc = new LedgerService(new InMemoryLedgerStore(),
            Clock.fixed(Instant.parse("2026-01-05T00:00:00Z"), ZoneOffset.UTC));

    private long bal(AccountId a, BalanceType t) {
        return svc.balance(LedgerStoreConformance.T, a, t, Currency.THB, D).minor();
    }

    private void fund() {
        svc.post(LedgerStoreConformance.deposit("d1", "dk1", D, 1000));
    }

    @Test
    void placeMovesSettledToHold() {
        fund();
        svc.post(Holds.place(LedgerStoreConformance.T, new BatchId("h1"), new IdempotencyKey("hk1"), D,
                LedgerStoreConformance.CUSTOMER, Money.ofMinor(300, Currency.THB)));
        assertThat(bal(LedgerStoreConformance.CUSTOMER, BalanceType.SETTLED)).isEqualTo(700);
        assertThat(bal(LedgerStoreConformance.CUSTOMER, BalanceType.HOLD)).isEqualTo(300);
    }

    @Test
    void releaseRestoresAvailable() {
        fund();
        svc.post(Holds.place(LedgerStoreConformance.T, new BatchId("h1"), new IdempotencyKey("hk1"), D,
                LedgerStoreConformance.CUSTOMER, Money.ofMinor(300, Currency.THB)));
        svc.reverse(LedgerStoreConformance.T, new BatchId("h1"), new BatchId("rel"), new IdempotencyKey("rk"), D);
        assertThat(bal(LedgerStoreConformance.CUSTOMER, BalanceType.SETTLED)).isEqualTo(1000);
        assertThat(bal(LedgerStoreConformance.CUSTOMER, BalanceType.HOLD)).isZero();
    }

    @Test
    void captureSettlesToMerchant() {
        fund();
        Money m = Money.ofMinor(300, Currency.THB);
        svc.post(Holds.place(LedgerStoreConformance.T, new BatchId("h1"), new IdempotencyKey("hk1"), D,
                LedgerStoreConformance.CUSTOMER, m));
        svc.post(Holds.capture(LedgerStoreConformance.T, new BatchId("c1"), new IdempotencyKey("ck1"), D,
                LedgerStoreConformance.CUSTOMER, MERCHANT, m));
        assertThat(bal(LedgerStoreConformance.CUSTOMER, BalanceType.HOLD)).isZero();
        assertThat(bal(MERCHANT, BalanceType.SETTLED)).isEqualTo(300);
        assertThat(bal(LedgerStoreConformance.CUSTOMER, BalanceType.SETTLED)).isEqualTo(700);
    }
}
