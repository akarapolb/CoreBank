package org.fabor.app;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Browser sign-in for the console (OIDC authorization code with PKCE, public client, no client secret in the browser).
 * Leave empty in token mode. The endpoints come from the identity provider's discovery document.
 */
@ConfigurationProperties(prefix = "fabor.console")
public record ConsoleProperties(String clientId, String appClientId, String authorizationEndpoint, String tokenEndpoint, String scope) {
    public ConsoleProperties {
        if (appClientId == null || appClientId.isBlank()) {
            appClientId = "fabor-app";
        }
        if (scope == null || scope.isBlank()) {
            scope = "openid profile";
        }
    }

    public boolean configured() {
        return notBlank(clientId) && notBlank(authorizationEndpoint) && notBlank(tokenEndpoint);
    }

    /** Origin of the token endpoint, allowed as a fetch target by the console's content-security policy. */
    public String tokenOrigin() {
        if (!notBlank(tokenEndpoint)) {
            return "";
        }
        java.net.URI u = java.net.URI.create(tokenEndpoint);
        return u.getScheme() + "://" + u.getAuthority();
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
