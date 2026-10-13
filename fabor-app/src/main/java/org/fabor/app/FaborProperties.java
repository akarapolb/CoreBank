package org.fabor.app;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings under {@code fabor.*}. Secrets come from the environment (OpenBao in production), never from files.
 *
 * @param tenant       the tenant this process serves
 * @param apiToken     bearer token required on /api/** (placeholder for OIDC with Keycloak); the app refuses to start without it
 * @param masterKey    base64 key material for the PII vault key provider (dev); production uses a KMS-backed provider
 * @param grpcPort     port of the ledger gRPC endpoint, 0 to disable
 * @param groupCommit  use group commit for ledger appends
 */
@ConfigurationProperties(prefix = "fabor")
public record FaborProperties(String tenant, String apiToken, String masterKey, int grpcPort, boolean groupCommit,
                              boolean schedulerEnabled) {
    public FaborProperties {
        if (apiToken == null || apiToken.length() < 16) {
            throw new IllegalStateException("fabor.api-token (FABOR_API_TOKEN) must be set to at least 16 characters");
        }
        if (masterKey == null || masterKey.isBlank()) {
            throw new IllegalStateException("fabor.master-key (FABOR_MASTER_KEY) must be set");
        }
        if (tenant == null || tenant.isBlank()) {
            tenant = "bank-a";
        }
    }
}
