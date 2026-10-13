package org.fabor.scheduler;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Due-queue port, one implementation per database. Claiming is a lease: a claimed task is invisible to
 * other workers until its lease expires, so a crashed worker's tasks are picked up again (catch-up) and
 * handlers must be idempotent. Every implementation must pass {@link DueQueueConformance}.
 */
public interface DueQueueStore {
    /** Adds the task, or does nothing if the tenant already has a task with that key. @return true if added */
    boolean enqueue(Task task);

    /** Leases up to {@code limit} tasks that are due at {@code now}, oldest first. */
    List<Claimed> claim(Instant now, int limit, Instant leaseUntil);

    /** Removes the task, or reschedules it at {@code nextDue}. A stale token is ignored. @return true if applied */
    boolean complete(Claimed claimed, Optional<Instant> nextDue);

    /** Releases the task for another attempt at {@code retryAt}, or parks it as dead when {@code dead}. */
    boolean fail(Claimed claimed, Instant retryAt, boolean dead, String error);

    /** Tasks parked after exhausting retries. */
    List<Task> dead();

    /** Number of tasks waiting (due or not, excluding dead). */
    long pending();
}
