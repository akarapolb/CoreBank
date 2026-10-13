package org.fabor.agent;

import java.util.Set;
import org.fabor.platform.tenancy.TenantId;

/**
 * Who is calling: an agent identity, the human or customer it acts for, the tenant it is bound to, and
 * the tools its role may call. The tenant comes from authentication, never from tool arguments.
 */
public record AgentPrincipal(String agentId, String onBehalfOf, TenantId tenant, Set<String> allowedTools) {
    public AgentPrincipal {
        if (agentId == null || agentId.isBlank() || onBehalfOf == null || onBehalfOf.isBlank()) {
            throw new IllegalArgumentException("agentId and onBehalfOf are required");
        }
        allowedTools = Set.copyOf(allowedTools);
    }
}
