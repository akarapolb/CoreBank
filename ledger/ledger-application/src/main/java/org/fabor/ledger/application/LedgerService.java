package org.fabor.ledger.application;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Optional;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.ledger.domain.PostingBatch;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.IdempotencyKey;
import org.fabor.platform.tenancy.TenantId;

/** Use cases of the ledger. Time comes from the injected clock, never the system. */
public final class LedgerService {
    private final LedgerStore store;
    private final Clock clock;

    public LedgerService(LedgerStore store, Clock clock) {
        this.store = store;
        this.clock = clock;
    }

    public LedgerStore.PostResult post(PostingBatch batch) {
        return store.append(batch, clock.instant());
    }

    public LedgerStore.PostResult reverse(TenantId tenant, BatchId original, BatchId newId, IdempotencyKey key,
                                          LocalDate valueDate) {
        Optional<LedgerStore.StoredBatch> found = store.find(tenant, original);
        PostingBatch target = found.orElseThrow(() -> new InvalidReversalException("Unknown batch " + original.value()))
                .batch();
        return store.append(target.reversal(newId, key, valueDate), clock.instant());
    }

    public Money balance(TenantId tenant, AccountId account, BalanceType type, Currency currency,
                         LocalDate valueAsOf) {
        return store.balance(tenant, account, type, currency, valueAsOf, clock.instant());
    }
}
