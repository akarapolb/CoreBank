package org.fabor.accounting;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.fabor.ledger.api.BatchPostedEvent;

/**
 * General-ledger balances built only from {@code BatchPosted} events, independently of the ledger's own
 * tables. Applying the same event twice has no effect (at-least-once delivery is safe). Contingent entries
 * are off balance sheet and are not part of the GL balances. Balances are credit-normal: assets are negative.
 */
public final class GlProjection {
    private final GlMapping mapping;
    private final Set<String> applied = new HashSet<>();
    private final Map<String, Long> balances = new TreeMap<>();

    public GlProjection(GlMapping mapping) {
        this.mapping = mapping;
    }

    public synchronized boolean apply(BatchPostedEvent e) {
        if (!applied.add(e.tenant() + "/" + e.batchId())) {
            return false;
        }
        for (var line : e.entries()) {
            if ("CONTINGENT".equals(line.balanceType())) {
                continue;
            }
            GlAccount gl = mapping.map(line.account());
            long signed = "CREDIT".equals(line.direction()) ? line.minor() : -line.minor();
            balances.merge(key(e.tenant(), gl.code(), line.currency()), signed, Math::addExact);
        }
        return true;
    }

    public boolean applyJson(String payload) {
        return apply(BatchPostedEvent.fromJson(payload));
    }

    public synchronized long balance(String tenant, String glCode, String currency) {
        return balances.getOrDefault(key(tenant, glCode, currency), 0L);
    }

    public synchronized Map<String, Long> snapshot() {
        return Map.copyOf(balances);
    }

    static String key(String tenant, String glCode, String currency) {
        return tenant + "|" + glCode + "|" + currency;
    }

    public GlMapping mapping() {
        return mapping;
    }
}
