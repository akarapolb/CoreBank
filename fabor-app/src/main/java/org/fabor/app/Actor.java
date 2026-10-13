package org.fabor.app;

import java.util.Set;

/**
 * Who is calling and what they may do. In OIDC mode the name and roles come from the verified token. In the
 * development token mode the name comes from X-Actor and the wildcard role grants everything.
 */
public record Actor(String name, Set<String> roles) {
    public static final String ANY = "*";

    public boolean has(String role) {
        return roles.contains(ANY) || roles.contains(role);
    }

    /** @throws SecurityException (mapped to 403) if the actor lacks the role */
    public Actor require(String role) {
        if (!has(role)) {
            throw new SecurityException("Role '" + role + "' is required");
        }
        return this;
    }
}
