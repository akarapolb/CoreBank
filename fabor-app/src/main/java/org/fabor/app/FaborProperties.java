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
 * @param keyProvider  {@code config} (dev: keys derived from masterKey) or {@code openbao} (keys read from OpenBao KV v2)
 */
@ConfigurationProperties(prefix = "fabor")
public record FaborProperties(String tenant, String authMode, String apiToken, String masterKey, int grpcPort,
                              boolean groupCommit, boolean schedulerEnabled, String keyProvider, String openbaoUrl,
                              String openbaoToken, String openbaoMount) {
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
        if (keyProvider == null || keyProvider.isBlank()) {
            keyProvider = "config";
        }
        if (keyProvider.equals("config") && (masterKey == null || masterKey.isBlank())) {
            throw new IllegalStateException("fabor.master-key (FABOR_MASTER_KEY) must be set when fabor.key-provider=config");
        }
        if (keyProvider.equals("openbao") && (openbaoUrl == null || openbaoUrl.isBlank() || openbaoToken == null || openbaoToken.isBlank())) {
            throw new IllegalStateException("fabor.openbao-url and fabor.openbao-token are required when fabor.key-provider=openbao");
        }
        if (!keyProvider.equals("config") && !keyProvider.equals("openbao")) {
            throw new IllegalStateException("fabor.key-provider must be 'config' or 'openbao'");
        }
        if (openbaoMount == null || openbaoMount.isBlank()) {
            openbaoMount = "secret";
        }
        if (tenant == null || tenant.isBlank()) {
            tenant = "bank-a";
        }
    }

    public boolean tokenMode() {
        return authMode.equals("token");
    }
}
