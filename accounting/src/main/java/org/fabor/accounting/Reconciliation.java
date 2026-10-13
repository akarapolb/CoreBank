package org.fabor.accounting;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.fabor.ledger.application.LedgerStore;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.platform.money.Currency;
import org.fabor.platform.tenancy.TenantId;

/**
 * Daily check that the event-fed GL agrees with the ledger: for every GL account and currency, the sum of the
 * mapped ledger account balances must equal the projection, and the whole ledger must net to zero. A break
 * names the GL account and both figures so the operations team (or an AI agent) can trace it.
 */
public final class Reconciliation {
    public record Break(String glCode, String currency, long ledger, long projection) {
        public long difference() {
            return ledger - projection;
        }
    }

    public record Report(List<Break> breaks, Map<String, Long> ledgerNetByCurrency, int accountsChecked) {
        public boolean clean() {
            return breaks.isEmpty() && ledgerNetByCurrency.values().stream().allMatch(v -> v == 0);
        }
    }

    private static final Set<BalanceType> ON_BALANCE_SHEET = Set.of(BalanceType.SETTLED, BalanceType.PENDING, BalanceType.HOLD);

    private Reconciliation() { }

    public static Report run(LedgerStore ledger, TenantId tenant, GlProjection projection, Set<Currency> currencies) {
        Map<String, Long> ledgerByGl = new TreeMap<>();
        Map<String, Long> net = new TreeMap<>();
        List<AccountId> accounts = ledger.accounts(tenant);
        for (AccountId a : accounts) {
            var gl = projection.mapping().map(a.value());
            for (Currency c : currencies) {
                long sum = 0;
                for (BalanceType t : ON_BALANCE_SHEET) {
                    sum += ledger.currentBalance(tenant, a, t, c).minor();
                }
                ledgerByGl.merge(gl.code() + "|" + c.code(), sum, Math::addExact);
                net.merge(c.code(), sum, Math::addExact);
            }
        }
        List<Break> breaks = new ArrayList<>();
        java.util.Set<String> keys = new java.util.TreeSet<>(ledgerByGl.keySet());
        projection.snapshot().keySet().stream().filter(k -> k.startsWith(tenant.value() + "|"))
                .map(k -> k.substring(tenant.value().length() + 1)).forEach(keys::add);
        for (String k : keys) {
            String[] parts = k.split("\\|");
            long l = ledgerByGl.getOrDefault(k, 0L);
            long p = projection.balance(tenant.value(), parts[0], parts[1]);
            if (l != p) {
                breaks.add(new Break(parts[0], parts[1], l, p));
            }
        }
        return new Report(List.copyOf(breaks), Map.copyOf(net), accounts.size());
    }
}
