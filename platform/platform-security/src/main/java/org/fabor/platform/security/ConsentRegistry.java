package org.fabor.platform.security;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import org.fabor.platform.tenancy.TenantId;

/**
 * PDPA consent registry: purpose-specific, versioned, withdrawable at any time, history never edited.
 * A consent applies to the purpose text version the person actually saw.
 */
public final class ConsentRegistry {
    public enum Action { GRANTED, WITHDRAWN }

    public record Event(Instant at, String party, String purpose, int purposeVersion, Action action, String channel) { }

    /** Storage port. {@code append} must reject events older than the party's latest for that purpose. */
    public interface Store {
        void append(TenantId tenant, Event event);

        List<Event> history(TenantId tenant, String party, String purpose);

        /** Distinct purposes ever recorded for the party. */
        java.util.Set<String> purposes(TenantId tenant, String party);
    }

    /** In-memory store for tests. */
    public static final class InMemoryStore implements Store {
        private final Map<String, List<Event>> history = new ConcurrentHashMap<>();

        @Override
        public synchronized void append(TenantId t, Event e) {
            List<Event> list = history.computeIfAbsent(key(t, e.party(), e.purpose()), k -> new ArrayList<>());
            if (!list.isEmpty() && e.at().isBefore(list.get(list.size() - 1).at())) {
                throw new IllegalArgumentException("Consent events must be recorded in time order");
            }
            list.add(e);
        }

        @Override
        public synchronized List<Event> history(TenantId t, String party, String purpose) {
            return List.copyOf(history.getOrDefault(key(t, party, purpose), List.of()));
        }

        @Override
        public synchronized java.util.Set<String> purposes(TenantId t, String party) {
            String prefix = t.value() + "/" + party + "/";
            java.util.Set<String> out = new java.util.TreeSet<>();
            history.keySet().stream().filter(k -> k.startsWith(prefix)).forEach(k -> out.add(k.substring(prefix.length())));
            return out;
        }
    }

    private final Store store;

    public ConsentRegistry() {
        this(new InMemoryStore());
    }

    public ConsentRegistry(Store store) {
        this.store = store;
    }

    static String key(TenantId t, String party, String purpose) {
        return t.value() + "/" + party + "/" + purpose;
    }

    public void grant(TenantId t, String party, String purpose, int purposeVersion, Instant at, String channel) {
        store.append(t, new Event(at, party, purpose, purposeVersion, Action.GRANTED, channel));
    }

    public void withdraw(TenantId t, String party, String purpose, Instant at, String channel) {
        Event last = latest(t, party, purpose, at);
        store.append(t, new Event(at, party, purpose, last == null ? 0 : last.purposeVersion(), Action.WITHDRAWN, channel));
    }

    /** True if the latest event at or before {@code at} is a grant of at least {@code minVersion}. */
    public boolean isGranted(TenantId t, String party, String purpose, int minVersion, Instant at) {
        Event e = latest(t, party, purpose, at);
        return e != null && e.action() == Action.GRANTED && e.purposeVersion() >= minVersion;
    }

    /** Full, ordered history for a data-subject access request. */
    public List<Event> history(TenantId t, String party, String purpose) {
        return store.history(t, party, purpose);
    }

    /** Every purpose a party currently consents to. */
    public Map<String, Integer> current(TenantId t, String party, Instant at) {
        Map<String, Integer> out = new TreeMap<>();
        for (String purpose : store.purposes(t, party)) {
            Event e = latest(t, party, purpose, at);
            if (e != null && e.action() == Action.GRANTED) {
                out.put(purpose, e.purposeVersion());
            }
        }
        return out;
    }

    private Event latest(TenantId t, String party, String purpose, Instant at) {
        Event best = null;
        for (Event e : store.history(t, party, purpose)) {
            if (!e.at().isAfter(at)) {
                best = e;
            }
        }
        return best;
    }
}
