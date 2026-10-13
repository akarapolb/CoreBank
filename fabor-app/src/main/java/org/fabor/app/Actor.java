package org.fabor.app;

import java.util.Set;

/**
 * Who is calling and what they may do. In OIDC mode the name, roles and (for customers) party id come from the verified
 * token. In the development token mode the name comes from X-Actor, the party from X-Party, and the wildcard role grants
 * everything.
 */
public record Actor(String name, Set<String> roles, String partyId) {
    public static final String ANY = "*";

    public Actor(String name, Set<String> roles) {
        this(name, roles, null);
    }

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

    /** The signed-in customer's own party id. Never taken from a request path or body. */
    public String customerParty() {
        require("customer");
        if (partyId == null || partyId.isBlank()) {
            throw new SecurityException("This login is not linked to a customer");
        }
        return partyId;
    }
}
