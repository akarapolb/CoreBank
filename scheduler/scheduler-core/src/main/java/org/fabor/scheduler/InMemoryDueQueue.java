package org.fabor.scheduler;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Reference implementation; also the executable specification of the port. */
public final class InMemoryDueQueue implements DueQueueStore {
    private static final class Row {
        long id;
        Task task;
        Instant dueAt;
        Instant leaseUntil;
        String token;
        int attempts;
        boolean dead;
    }

    private final Map<String, Row> byKey = new HashMap<>();
    private final Map<Long, Row> byId = new HashMap<>();
    private long nextId = 1;

    @Override
    public synchronized boolean enqueue(Task t) {
        String k = t.tenant().value() + "/" + t.key();
        if (byKey.containsKey(k)) {
            return false;
        }
        Row r = new Row();
        r.id = nextId++;
        r.task = t;
        r.dueAt = t.dueAt();
        byKey.put(k, r);
        byId.put(r.id, r);
        return true;
    }

    @Override
    public synchronized List<Claimed> claim(Instant now, int limit, Instant leaseUntil) {
        List<Row> due = new ArrayList<>();
        for (Row r : byId.values()) {
            if (!r.dead && !r.dueAt.isAfter(now) && (r.leaseUntil == null || !r.leaseUntil.isAfter(now))) {
                due.add(r);
            }
        }
        due.sort(Comparator.comparing((Row r) -> r.dueAt).thenComparingLong(r -> r.id));
        List<Claimed> out = new ArrayList<>();
        for (Row r : due.subList(0, Math.min(limit, due.size()))) {
            r.leaseUntil = leaseUntil;
            r.token = UUID.randomUUID().toString();
            r.attempts++;
            out.add(new Claimed(r.id, withDue(r), r.token, r.attempts));
        }
        return out;
    }

    private static Task withDue(Row r) {
        return new Task(r.task.tenant(), r.task.key(), r.task.type(), r.task.arrangementId(), r.dueAt, r.task.payload());
    }

    @Override
    public synchronized boolean complete(Claimed c, Optional<Instant> nextDue) {
        Row r = byId.get(c.id());
        if (r == null || !c.token().equals(r.token)) {
            return false;
        }
        if (nextDue.isPresent()) {
            r.dueAt = nextDue.get();
            r.leaseUntil = null;
            r.token = null;
            r.attempts = 0;
        } else {
            byId.remove(r.id);
            byKey.remove(r.task.tenant().value() + "/" + r.task.key());
        }
        return true;
    }

    @Override
    public synchronized boolean fail(Claimed c, Instant retryAt, boolean dead, String error) {
        Row r = byId.get(c.id());
        if (r == null || !c.token().equals(r.token)) {
            return false;
        }
        r.dueAt = retryAt;
        r.leaseUntil = null;
        r.token = null;
        r.dead = dead;
        return true;
    }

    @Override
    public synchronized List<Task> dead() {
        return byId.values().stream().filter(r -> r.dead).map(r -> r.task).toList();
    }

    @Override
    public synchronized long pending() {
        return byId.values().stream().filter(r -> !r.dead).count();
    }
}
