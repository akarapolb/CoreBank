package org.fabor.platform.tenancy;

/** Identifies a bank or brand hosted on the platform. */
public record TenantId(String value) {
    public TenantId {
        if (value == null || !value.matches("[a-z0-9][a-z0-9-]{1,62}")) {
            throw new IllegalArgumentException("Invalid tenant id: " + value);
        }
    }
}
