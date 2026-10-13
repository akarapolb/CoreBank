package org.fabor.scheduler;

import java.time.Instant;
import java.util.Optional;

/** Executes one task. Must be idempotent: the same task can run more than once after a crash. */
@FunctionalInterface
public interface TaskHandler {
    /** @return the next due time for recurring work, or empty when the task is finished */
    Optional<Instant> handle(Task task, int attempt) throws Exception;
}
