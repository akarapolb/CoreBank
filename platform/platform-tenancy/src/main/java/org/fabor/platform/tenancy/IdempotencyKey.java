package org.fabor.platform.tenancy;

/** Client-supplied key making a request safe to retry. Unique per tenant. */
public record IdempotencyKey(String value) {
    public IdempotencyKey {
        if (value == null || value.isBlank() || value.length() > 128) {
            throw new IllegalArgumentException("Idempotency key must be 1..128 characters");
        }
    }
}
