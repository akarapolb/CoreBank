package org.fabor.agent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.fabor.ledger.application.LedgerService;
import org.fabor.ledger.domain.BatchId;
import org.fabor.ledger.testkit.InMemoryLedgerStore;
import org.fabor.ledger.testkit.LedgerStoreConformance;
import org.fabor.platform.tenancy.TenantId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AgentGatewayTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final List<AuditSink.Entry> audit = new ArrayList<>();
    private AgentGateway gateway;
    private final AgentPrincipal agent = new AgentPrincipal("assistant-1", "customer-42", new TenantId("bank-a"),
            Set.of("ledger_get_balance", "ledger_get_batch"));

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-01-05T00:00:00Z"), ZoneOffset.UTC);
        InMemoryLedgerStore store = new InMemoryLedgerStore();
        LedgerService ledger = new LedgerService(store, clock);
        ledger.post(LedgerStoreConformance.deposit("b1", "k1", LocalDate.of(2026, 1, 1), 1250));
        gateway = new AgentGateway(LedgerTools.register(new ToolRegistry(), ledger, store), audit::add, clock);
    }

    private JsonNode rpc(AgentPrincipal p, String body) throws Exception {
        return JSON.readTree(gateway.handle(p, body));
    }

    private static String call(String tool, String args) {
        return "{\"jsonrpc\":\"2.0\",\"id\":7,\"method\":\"tools/call\",\"params\":{\"name\":\"" + tool
                + "\",\"arguments\":" + args + "}}";
    }

    @Test
    void initializeAndList() throws Exception {
        assertThat(rpc(agent, "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\"}").at("/result/serverInfo/name")
                .asText()).isEqualTo("fabor-agent-gateway");
        JsonNode tools = rpc(agent, "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/list\"}").at("/result/tools");
        assertThat(tools).hasSize(2);
        AgentPrincipal narrow = new AgentPrincipal("a", "u", new TenantId("bank-a"), Set.of("ledger_get_batch"));
        assertThat(rpc(narrow, "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/list\"}").at("/result/tools")).hasSize(1);
    }

    @Test
    void readsBalanceAndBatch() throws Exception {
        JsonNode r = rpc(agent, call("ledger_get_balance",
                "{\"account\":\"cust-1\",\"balance_type\":\"SETTLED\",\"currency\":\"THB\",\"value_as_of\":\"2026-01-01\"}"));
        assertThat(r.at("/result/isError").asBoolean()).isFalse();
        assertThat(JSON.readTree(r.at("/result/content/0/text").asText()).get("minor").asLong()).isEqualTo(1250);
        JsonNode b = rpc(agent, call("ledger_get_batch", "{\"batch_id\":\"b1\"}"));
        assertThat(b.at("/result/content/0/text").asText()).contains("\"cust-1\"");
        assertThat(audit).extracting(AuditSink.Entry::outcome).containsExactly("ok", "ok");
        assertThat(audit.get(0).onBehalfOf()).isEqualTo("customer-42");
    }

    @Test
    void forbiddenAndUnknownToolsLookTheSameAndAreAudited() throws Exception {
        AgentPrincipal narrow = new AgentPrincipal("a", "u", new TenantId("bank-a"), Set.of("ledger_get_batch"));
        JsonNode forbidden = rpc(narrow, call("ledger_get_balance", "{}"));
        JsonNode unknown = rpc(narrow, call("does_not_exist", "{}"));
        assertThat(forbidden.at("/error/code").asInt()).isEqualTo(-32602);
        assertThat(unknown.at("/error/code").asInt()).isEqualTo(-32602);
        assertThat(audit).extracting(AuditSink.Entry::outcome).containsExactly("denied", "denied");
    }

    @Test
    void tenantComesFromThePrincipalNotTheArguments() throws Exception {
        AgentPrincipal other = new AgentPrincipal("a", "u", new TenantId("bank-b"),
                Set.of("ledger_get_balance", "ledger_get_batch"));
        JsonNode r = rpc(other, call("ledger_get_batch", "{\"batch_id\":\"b1\",\"tenant\":\"bank-a\"}"));
        assertThat(r.at("/result/isError").asBoolean()).isTrue();
        assertThat(r.at("/result/content/0/text").asText()).isEqualTo("No such batch");
    }

    @Test
    void badArgumentsGiveSafeToolErrors() throws Exception {
        JsonNode r = rpc(agent, call("ledger_get_balance", "{\"account\":\"x\"}"));
        assertThat(r.at("/result/isError").asBoolean()).isTrue();
        assertThat(r.at("/result/content/0/text").asText()).contains("Missing argument");
        JsonNode r2 = rpc(agent, call("ledger_get_balance",
                "{\"account\":\"x\",\"balance_type\":\"NOPE\",\"currency\":\"THB\",\"value_as_of\":\"2026-01-01\"}"));
        assertThat(r2.at("/result/isError").asBoolean()).isTrue();
        assertThat(audit.get(1).outcome()).isEqualTo("refused");
    }

    @Test
    void protocolErrors() throws Exception {
        assertThat(rpc(agent, "not json").at("/error/code").asInt()).isEqualTo(-32700);
        assertThat(rpc(agent, "{\"id\":1,\"method\":\"tools/list\"}").at("/error/code").asInt()).isEqualTo(-32600);
        assertThat(rpc(agent, "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"nope\"}").at("/error/code").asInt())
                .isEqualTo(-32601);
        assertThat(rpc(agent, "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{}}")
                .at("/error/code").asInt()).isEqualTo(-32602);
        assertThat(rpc(agent, "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"x\","
                + "\"arguments\":[1]}}").at("/error/code").asInt()).isEqualTo(-32602);
    }

    @Test
    void unexpectedFailuresDoNotLeakDetails() throws Exception {
        ToolRegistry reg = new ToolRegistry().register(new Tool() {
            public String name() { return "boom"; }
            public String description() { return "x"; }
            public JsonNode inputSchema() { return JSON.createObjectNode(); }
            public boolean readOnly() { return true; }
            public JsonNode call(AgentPrincipal p, JsonNode a) { throw new IllegalStateException("jdbc:secret"); }
        });
        AgentGateway g = new AgentGateway(reg, audit::add, Clock.systemUTC());
        AgentPrincipal p = new AgentPrincipal("a", "u", new TenantId("bank-a"), Set.of("boom"));
        String out = g.handle(p, call("boom", "{}"));
        assertThat(out).contains("Internal error").doesNotContain("secret");
        assertThat(audit.get(audit.size() - 1).outcome()).isEqualTo("error");
    }

    @Test
    void writeToolsCannotBeRegisteredInPhase0() {
        Tool writer = new Tool() {
            public String name() { return "ledger_post"; }
            public String description() { return "x"; }
            public JsonNode inputSchema() { return JSON.createObjectNode(); }
            public boolean readOnly() { return false; }
            public JsonNode call(AgentPrincipal p, JsonNode a) { return null; }
        };
        assertThatThrownBy(() -> new ToolRegistry().register(writer)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ToolRegistry().register(new LedgerTools.GetBatch(null)).register(new LedgerTools.GetBatch(null)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AgentPrincipal("", "u", new TenantId("bank-a"), Set.of()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(new BatchId("x").value()).isEqualTo("x");
    }

    @Test
    void oversizedResultsAreRefused() throws Exception {
        ToolRegistry reg = new ToolRegistry().register(new Tool() {
            public String name() { return "big"; }
            public String description() { return "x"; }
            public JsonNode inputSchema() { return JSON.createObjectNode(); }
            public boolean readOnly() { return true; }
            public JsonNode call(AgentPrincipal p, JsonNode a) { return JSON.createObjectNode().put("x", "y".repeat(30_000)); }
        });
        AgentGateway g = new AgentGateway(reg, audit::add, Clock.systemUTC());
        AgentPrincipal p = new AgentPrincipal("a", "u", new TenantId("bank-a"), Set.of("big"));
        JsonNode r = JSON.readTree(g.handle(p, "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\","
                + "\"params\":{\"name\":\"big\"}}"));
        assertThat(r.at("/result/isError").asBoolean()).isTrue();
        assertThat(audit.get(audit.size() - 1).outcome()).isEqualTo("too_large");
    }

    @Test
    void requestShapeEdgeCases() throws Exception {
        assertThat(rpc(agent, "[]").at("/error/code").asInt()).isEqualTo(-32600);
        assertThat(rpc(agent, "{\"jsonrpc\":\"1.0\",\"id\":1,\"method\":\"x\"}").at("/error/code").asInt()).isEqualTo(-32600);
        assertThat(rpc(agent, "{\"jsonrpc\":\"2.0\",\"method\":\"tools/list\"}").get("id").isNull()).isTrue();
    }

    @Test
    void principalValidation() {
        TenantId t = new TenantId("bank-a");
        assertThatThrownBy(() -> new AgentPrincipal(null, "u", t, Set.of())).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AgentPrincipal("a", null, t, Set.of())).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AgentPrincipal("a", " ", t, Set.of())).isInstanceOf(IllegalArgumentException.class);
    }
}
