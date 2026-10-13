package org.fabor.app;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.fabor.platform.security.KeyProvider;
import org.fabor.platform.tenancy.TenantId;

/**
 * Development key provider: derives per-tenant, per-purpose keys from one master secret with HMAC-SHA256.
 * Production replaces this with a provider backed by OpenBao (transit) so the master never sits in the process.
 */
final class ConfigKeyProvider implements KeyProvider {
    private final byte[] master;
    private final String keyId;

    ConfigKeyProvider(String masterKeyBase64, String keyId) {
        this.master = Base64.getDecoder().decode(masterKeyBase64);
        if (master.length < 32) {
            throw new IllegalStateException("fabor.master-key must decode to at least 32 bytes");
        }
        this.keyId = keyId;
    }

    @Override
    public String currentKeyId(TenantId tenant) {
        return keyId;
    }

    @Override
    public byte[] dataKey(TenantId tenant, String id) {
        return derive("data|" + tenant.value() + "|" + id);
    }

    @Override
    public byte[] indexKey(TenantId tenant) {
        return derive("index|" + tenant.value());
    }

    private byte[] derive(String label) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(master, "HmacSHA256"));
            return mac.doFinal(label.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
