package org.fabor.app;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings under {@code fabor.*}. Secrets come from the environment (OpenBao in production), never from files.
 *
 * @param tenant       the tenant this process serves
 * @param authMode     {@code oidc} (default): JWT bearer tokens from the identity provider (Keycloak), verified against its
 *                     JWKS, roles from {@code realm_access.roles}. {@code token}: a shared bearer token for local
 *                     development only, with every role granted; it must be chosen explicitly.
 * @param apiToken     the shared token for {@code token} mode (at least 16 characters)
 * @param masterKey    base64 key material for the PII vault key provider (dev); production uses a KMS-backed provider
 * @param grpcPort     port of the ledger gRPC endpoint, 0 to disable
 * @param groupCommit  use group commit for ledger appends
 */
@ConfigurationProperties(prefix = "fabor")
public record FaborProperties(String tenant, String authMode, String apiToken, String masterKey, int grpcPort,
                              boolean groupCommit, boolean schedulerEnabled) {
    public FaborProperties {
        if (authMode == null || authMode.isBlank()) {
            authMode = "oidc";
        }
        if (!authMode.equals("oidc") && !authMode.equals("token")) {
            throw new IllegalStateException("fabor.auth-mode must be 'oidc' or 'token'");
        }
        if (authMode.equals("token") && (apiToken == null || apiToken.length() < 16)) {
            throw new IllegalStateException("fabor.api-token (FABOR_API_TOKEN) must be at least 16 characters in token mode");
        }
        if (masterKey == null || masterKey.isBlank()) {
            throw new IllegalStateException("fabor.master-key (FABOR_MASTER_KEY) must be set");
        }
        if (tenant == null || tenant.isBlank()) {
            tenant = "bank-a";
        }
    }

    public boolean tokenMode() {
        return authMode.equals("token");
    }
}
