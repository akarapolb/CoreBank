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

    private final Map<String, List<Event>> history = new ConcurrentHashMap<>();

    private static String key(TenantId t, String party, String purpose) {
        return t.value() + "/" + party + "/" + purpose;
    }

    public synchronized void grant(TenantId t, String party, String purpose, int purposeVersion, Instant at, String channel) {
        append(t, new Event(at, party, purpose, purposeVersion, Action.GRANTED, channel));
    }

    public synchronized void withdraw(TenantId t, String party, String purpose, Instant at, String channel) {
        int version = latest(t, party, purpose, at) == null ? 0 : latest(t, party, purpose, at).purposeVersion();
        append(t, new Event(at, party, purpose, version, Action.WITHDRAWN, channel));
    }

    /** True if the latest event at or before {@code at} is a grant of at least {@code minVersion}. */
    public synchronized boolean isGranted(TenantId t, String party, String purpose, int minVersion, Instant at) {
        Event e = latest(t, party, purpose, at);
        return e != null && e.action() == Action.GRANTED && e.purposeVersion() >= minVersion;
    }

    /** Full, ordered history for a data-subject access request. */
    public synchronized List<Event> history(TenantId t, String party, String purpose) {
        return List.copyOf(history.getOrDefault(key(t, party, purpose), List.of()));
    }

    /** Every purpose a party currently consents to. */
    public synchronized Map<String, Integer> current(TenantId t, String party, Instant at) {
        Map<String, Integer> out = new TreeMap<>();
        String prefix = t.value() + "/" + party + "/";
        for (var en : history.entrySet()) {
            if (en.getKey().startsWith(prefix)) {
                String purpose = en.getKey().substring(prefix.length());
                Event e = latest(t, party, purpose, at);
                if (e != null && e.action() == Action.GRANTED) {
                    out.put(purpose, e.purposeVersion());
                }
            }
        }
        return out;
    }

    private void append(TenantId t, Event e) {
        List<Event> list = history.computeIfAbsent(key(t, e.party(), e.purpose()), k -> new ArrayList<>());
        if (!list.isEmpty() && e.at().isBefore(list.get(list.size() - 1).at())) {
            throw new IllegalArgumentException("Consent events must be recorded in time order");
        }
        list.add(e);
    }

    private Event latest(TenantId t, String party, String purpose, Instant at) {
        Event best = null;
        for (Event e : history.getOrDefault(key(t, party, purpose), List.of())) {
            if (!e.at().isAfter(at)) {
                best = e;
            }
        }
        return best;
    }
}
