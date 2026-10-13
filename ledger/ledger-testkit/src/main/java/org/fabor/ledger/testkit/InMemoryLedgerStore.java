package org.fabor.ledger.testkit;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.fabor.ledger.application.IdempotencyConflictException;
import org.fabor.ledger.application.InvalidReversalException;
import org.fabor.ledger.application.LedgerStore;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.ledger.domain.Entry;
import org.fabor.ledger.domain.PostingBatch;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.TenantId;

/** Reference implementation used by fast tests and as the executable specification of the SPI. */
public final class InMemoryLedgerStore implements LedgerStore {
    private final List<StoredBatch> log = new ArrayList<>();
    private final Map<String, StoredBatch> byKey = new HashMap<>();
    private final Map<String, StoredBatch> byId = new HashMap<>();
    private final Set<String> reversed = new HashSet<>();

    @Override
    public synchronized PostResult append(PostingBatch batch, Instant recordedAt) {
        String keyRef = batch.tenant().value() + "/" + batch.key().value();
        StoredBatch prior = byKey.get(keyRef);
        if (prior != null) {
            if (!prior.batch().equals(batch)) {
                throw new IdempotencyConflictException("Key reused with different content: " + batch.key().value());
            }
            return new PostResult(prior, true);
        }
        String idRef = batch.tenant().value() + "/" + batch.id().value();
        if (byId.containsKey(idRef)) {
            throw new IdempotencyConflictException("Batch id already used: " + batch.id().value());
        }
        if (batch.reverses().isPresent()) {
            BatchId target = batch.reverses().get();
            String targetRef = batch.tenant().value() + "/" + target.value();
            StoredBatch original = byId.get(targetRef);
            if (original == null) {
                throw new InvalidReversalException("Unknown batch " + target.value());
            }
            if (original.batch().reverses().isPresent()) {
                throw new InvalidReversalException("A reversal cannot be reversed");
            }
            if (!reversed.add(targetRef)) {
                throw new InvalidReversalException("Batch already reversed: " + target.value());
            }
        }
        StoredBatch stored = new StoredBatch(batch, recordedAt);
        log.add(stored);
        byKey.put(keyRef, stored);
        byId.put(idRef, stored);
        return new PostResult(stored, false);
    }

    @Override
    public synchronized Optional<StoredBatch> find(TenantId tenant, BatchId id) {
        return Optional.ofNullable(byId.get(tenant.value() + "/" + id.value()));
    }

    @Override
    public synchronized Money balance(TenantId tenant, AccountId account, BalanceType type, Currency currency,
                                      LocalDate valueAsOf, Instant recordedAsOf) {
        long sum = 0;
        for (StoredBatch s : log) {
            PostingBatch b = s.batch();
            if (!b.tenant().equals(tenant) || b.valueDate().isAfter(valueAsOf) || s.recordedAt().isAfter(recordedAsOf)) {
                continue;
            }
            for (Entry e : b.entries()) {
                if (e.account().equals(account) && e.type() == type && e.amount().currency().equals(currency)) {
                    sum = Math.addExact(sum, e.signedMinor());
                }
            }
        }
        return Money.ofMinor(sum, currency);
    }
}
