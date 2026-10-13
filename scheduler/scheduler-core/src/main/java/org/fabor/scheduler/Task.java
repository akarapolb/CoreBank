package org.fabor.scheduler;

import java.time.Instant;
import java.util.Objects;
import org.fabor.platform.tenancy.TenantId;

/**
 * A unit of due work. {@code key} makes enqueueing idempotent per tenant (for example
 * {@code "accrual-post:ARR-123:2026-01-31"}); {@code arrangementId} names what the work is about.
 */
public record Task(TenantId tenant, String key, String type, String arrangementId, Instant dueAt, String payload) {
    public Task {
        Objects.requireNonNull(tenant, "tenant");
        Objects.requireNonNull(dueAt, "dueAt");
        if (key == null || key.isBlank() || type == null || type.isBlank() || arrangementId == null || arrangementId.isBlank()) {
            throw new IllegalArgumentException("key, type and arrangementId are required");
        }
        payload = payload == null ? "" : payload;
    }
}
