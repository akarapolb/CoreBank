package org.fabor.platform.security;

import org.fabor.platform.tenancy.TenantId;

/** Source of per-tenant keys. Production binds to KMS/HSM (OpenBao); keys never leave it unwrapped for long. */
public interface KeyProvider {
    String currentKeyId(TenantId tenant);

    /** 32 bytes for AES-256-GCM. */
    byte[] dataKey(TenantId tenant, String keyId);

    /** 32 bytes for the HMAC blind index. */
    byte[] indexKey(TenantId tenant);
}
