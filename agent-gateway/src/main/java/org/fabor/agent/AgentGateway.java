package org.fabor.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Clock;

/**
 * Transport-neutral MCP endpoint (JSON-RPC 2.0): {@code initialize}, {@code tools/list}, {@code tools/call}.
 * Every call is checked against the principal's entitlements and audited, whatever its outcome.
 * Guardrails still to come (docs/06): PII redaction, delegated authority limits, human-in-the-loop for writes.
 */
public final class AgentGateway {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final int MAX_RESULT_CHARS = 20_000;

    private final ToolRegistry registry;
    private final AuditSink audit;
    private final Clock clock;

    public AgentGateway(ToolRegistry registry, AuditSink audit, Clock clock) {
        this.registry = registry;
        this.audit = audit;
        this.clock = clock;
    }

    /** Handles one JSON-RPC request and returns the response as a JSON string. */
    public String handle(AgentPrincipal principal, String requestJson) {
        JsonNode req;
        try {
            req = JSON.readTree(requestJson);
        } catch (Exception e) {
            return error(null, -32700, "Parse error");
        }
        JsonNode id = req.get("id");
        if (!req.isObject() || !"2.0".equals(req.path("jsonrpc").asText()) || !req.has("method")) {
            return error(id, -32600, "Invalid request");
        }
        return switch (req.get("method").asText()) {
            case "initialize" -> result(id, initialize());
            case "tools/list" -> result(id, list(principal));
            case "tools/call" -> call(principal, id, req.path("params"));
            default -> error(id, -32601, "Method not found");
        };
    }

    private ObjectNode initialize() {
        ObjectNode n = JSON.createObjectNode();
        n.put("protocolVersion", "2025-03-26");
        n.putObject("capabilities").putObject("tools");
        n.putObject("serverInfo").put("name", "fabor-agent-gateway").put("version", "0.1.0");
        return n;
    }

    private ObjectNode list(AgentPrincipal p) {
        ArrayNode arr = JSON.createObjectNode().putArray("tools");
        for (Tool t : registry.all()) {
            if (p.allowedTools().contains(t.name())) {
                ObjectNode o = arr.addObject();
                o.put("name", t.name());
                o.put("description", t.description());
                o.set("inputSchema", t.inputSchema());
            }
        }
        ObjectNode out = JSON.createObjectNode();
        out.set("tools", arr);
        return out;
    }

    private String call(AgentPrincipal p, JsonNode id, JsonNode params) {
        String name = params.path("name").asText("");
        JsonNode args = params.has("arguments") ? params.get("arguments") : JSON.createObjectNode();
        if (name.isEmpty() || !args.isObject()) {
            return error(id, -32602, "Invalid params");
        }
        Tool tool = registry.find(name).orElse(null);
        if (tool == null || !p.allowedTools().contains(name)) {
            audit(p, name, args, "denied");
            // same answer for unknown and forbidden tools: do not reveal what exists
            return error(id, -32602, "Unknown tool: " + name);
        }
        try {
            JsonNode out = tool.call(p, args);
            String text = JSON.writeValueAsString(out);
            if (text.length() > MAX_RESULT_CHARS) {
                audit(p, name, args, "too_large");
                return toolError(id, "Result too large; narrow the request");
            }
            audit(p, name, args, "ok");
            ObjectNode res = JSON.createObjectNode();
            res.putArray("content").addObject().put("type", "text").put("text", text);
            res.put("isError", false);
            return result(id, res);
        } catch (ToolException e) {
            audit(p, name, args, "refused");
            return toolError(id, e.getMessage());
        } catch (Exception e) {
            audit(p, name, args, "error");
            return toolError(id, "Internal error");
        }
    }

    private void audit(AgentPrincipal p, String tool, JsonNode args, String outcome) {
        audit.record(new AuditSink.Entry(clock.instant(), p.agentId(), p.onBehalfOf(), p.tenant().value(), tool,
                args.toString(), outcome));
    }

    private String toolError(JsonNode id, String message) {
        ObjectNode res = JSON.createObjectNode();
        res.putArray("content").addObject().put("type", "text").put("text", message);
        res.put("isError", true);
        return result(id, res);
    }

    private static String result(JsonNode id, JsonNode result) {
        ObjectNode n = JSON.createObjectNode();
        n.put("jsonrpc", "2.0");
        n.set("id", id == null ? JSON.nullNode() : id);
        n.set("result", result);
        return n.toString();
    }

    private static String error(JsonNode id, int code, String message) {
        ObjectNode n = JSON.createObjectNode();
        n.put("jsonrpc", "2.0");
        n.set("id", id == null ? JSON.nullNode() : id);
        n.putObject("error").put("code", code).put("message", message);
        return n.toString();
    }
}
