package org.fabor.ledger.domain;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.fabor.platform.money.Currency;
import org.fabor.platform.tenancy.IdempotencyKey;
import org.fabor.platform.tenancy.TenantId;

/**
 * An atomic, balanced set of entries. For every currency, total debits equal total credits.
 * {@code valueDate} is the effective (business) time; the store adds the recorded (system) time.
 */
public record PostingBatch(
        TenantId tenant,
        BatchId id,
        IdempotencyKey key,
        LocalDate valueDate,
        List<Entry> entries,
        Optional<BatchId> reverses) {

    public PostingBatch {
        Objects.requireNonNull(tenant, "tenant");
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(key, "key");
        Objects.requireNonNull(valueDate, "valueDate");
        Objects.requireNonNull(reverses, "reverses");
        entries = List.copyOf(entries);
        if (entries.size() < 2) {
            throw new IllegalArgumentException("A batch needs at least two entries");
        }
        Map<Currency, Long> net = new HashMap<>();
        for (Entry e : entries) {
            net.merge(e.amount().currency(), e.signedMinor(), Math::addExact);
        }
        net.forEach((cur, sum) -> {
            if (sum != 0) {
                throw new UnbalancedBatchException(cur, sum);
            }
        });
    }

    public static PostingBatch of(TenantId tenant, BatchId id, IdempotencyKey key, LocalDate valueDate,
                                  List<Entry> entries) {
        return new PostingBatch(tenant, id, key, valueDate, entries, Optional.empty());
    }

    /** The mirror batch that cancels this one. */
    public PostingBatch reversal(BatchId newId, IdempotencyKey newKey, LocalDate onValueDate) {
        return new PostingBatch(tenant, newId, newKey, onValueDate,
                entries.stream().map(Entry::inverse).toList(), Optional.of(id));
    }
}
