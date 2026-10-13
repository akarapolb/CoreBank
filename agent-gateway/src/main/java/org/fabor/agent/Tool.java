package org.fabor.agent;

import com.fasterxml.jackson.databind.JsonNode;

/** One capability exposed to agents. */
public interface Tool {
    String name();

    String description();

    /** JSON Schema of the arguments object. */
    JsonNode inputSchema();

    /** Phase 0 gateway accepts read-only tools only. */
    boolean readOnly();

    /** Returns a JSON result or throws {@link ToolException} with a message that is safe to show an agent. */
    JsonNode call(AgentPrincipal principal, JsonNode arguments);
}
