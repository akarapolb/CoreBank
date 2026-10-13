package org.fabor.scheduler;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Drains the due queue. Run one or more per shard; they never block each other because claims are leases.
 * A failing task is retried with exponential backoff and parked as dead after {@code maxAttempts}.
 */
public final class SchedulerWorker {
    private final DueQueueStore store;
    private final Map<String, TaskHandler> handlers;
    private final Clock clock;
    private final int batchSize;
    private final Duration lease;
    private final int maxAttempts;
    private final Duration baseBackoff;

    public SchedulerWorker(DueQueueStore store, Map<String, TaskHandler> handlers, Clock clock, int batchSize,
                           Duration lease, int maxAttempts, Duration baseBackoff) {
        this.store = store;
        this.handlers = Map.copyOf(handlers);
        this.clock = clock;
        this.batchSize = batchSize;
        this.lease = lease;
        this.maxAttempts = maxAttempts;
        this.baseBackoff = baseBackoff;
    }

    /** Claims and runs one batch. @return number of tasks handled (successfully or not) */
    public int runOnce() {
        Instant now = clock.instant();
        List<Claimed> batch = store.claim(now, batchSize, now.plus(lease));
        for (Claimed c : batch) {
            TaskHandler h = handlers.get(c.task().type());
            if (h == null) {
                store.fail(c, now, true, "No handler for task type " + c.task().type());
                continue;
            }
            try {
                Optional<Instant> next = h.handle(c.task(), c.attempt());
                store.complete(c, next);
            } catch (Exception e) {
                boolean dead = c.attempt() >= maxAttempts;
                Duration backoff = baseBackoff.multipliedBy(1L << Math.min(c.attempt() - 1, 16));
                store.fail(c, clock.instant().plus(backoff), dead, String.valueOf(e.getMessage()));
            }
        }
        return batch.size();
    }

    /** Runs batches until the queue has nothing due. Used after an outage to catch up. */
    public int drain() {
        int total = 0;
        for (int n = runOnce(); n > 0; n = runOnce()) {
            total += n;
        }
        return total;
    }
}
