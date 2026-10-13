package org.fabor.scheduler;

/** A task leased to one worker. Only the holder of {@code token} can complete or fail it. */
public record Claimed(long id, Task task, String token, int attempt) { }
