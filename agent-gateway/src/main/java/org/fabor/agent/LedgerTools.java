package org.fabor.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import org.fabor.ledger.application.LedgerService;
import org.fabor.ledger.application.LedgerStore;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.ledger.domain.Entry;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;

/** Read-only ledger tools. The tenant always comes from the principal. */
public final class LedgerTools {
    private static final ObjectMapper JSON = new ObjectMapper();

    private LedgerTools() { }

    public static ToolRegistry register(ToolRegistry registry, LedgerService ledger, LedgerStore store) {
        return registry.register(new GetBalance(ledger)).register(new GetBatch(store));
    }

    private static JsonNode schema(String json) {
        try {
            return JSON.readTree(json);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String required(JsonNode a, String field) {
        String v = a.path(field).asText("");
        if (v.isBlank()) {
            throw new ToolException("Missing argument: " + field);
        }
        return v;
    }

    static final class GetBalance implements Tool {
        private final LedgerService ledger;

        GetBalance(LedgerService ledger) {
            this.ledger = ledger;
        }

        @Override
        public String name() {
            return "ledger_get_balance";
        }

        @Override
        public String description() {
            return "Balance of one account bucket as of a value date (default today's date given by the caller).";
        }

        @Override
        public JsonNode inputSchema() {
            return schema("{\"type\":\"object\",\"required\":[\"account\",\"balance_type\",\"currency\",\"value_as_of\"],"
                    + "\"properties\":{\"account\":{\"type\":\"string\"},\"balance_type\":{\"enum\":[\"SETTLED\",\"PENDING\","
                    + "\"HOLD\",\"CONTINGENT\"]},\"currency\":{\"type\":\"string\",\"pattern\":\"^[A-Z]{3}$\"},"
                    + "\"value_as_of\":{\"type\":\"string\",\"format\":\"date\"}},\"additionalProperties\":false}");
        }

        @Override
        public boolean readOnly() {
            return true;
        }

        @Override
        public JsonNode call(AgentPrincipal p, JsonNode a) {
            try {
                Money m = ledger.balance(p.tenant(), new AccountId(required(a, "account")),
                        BalanceType.valueOf(required(a, "balance_type")), Currency.of(required(a, "currency")),
                        LocalDate.parse(required(a, "value_as_of")));
                ObjectNode out = JSON.createObjectNode();
                out.put("minor", m.minor());
                out.put("currency", m.currency().code());
                out.put("display", m.toString());
                return out;
            } catch (IllegalArgumentException | DateTimeParseException e) {
                throw new ToolException("Invalid argument: " + e.getMessage());
            }
        }
    }

    static final class GetBatch implements Tool {
        private final LedgerStore store;

        GetBatch(LedgerStore store) {
            this.store = store;
        }

        @Override
        public String name() {
            return "ledger_get_batch";
        }

        @Override
        public String description() {
            return "Fetch a posting batch with its entries, to explain why a balance is what it is.";
        }

        @Override
        public JsonNode inputSchema() {
            return schema("{\"type\":\"object\",\"required\":[\"batch_id\"],"
                    + "\"properties\":{\"batch_id\":{\"type\":\"string\"}},\"additionalProperties\":false}");
        }

        @Override
        public boolean readOnly() {
            return true;
        }

        @Override
        public JsonNode call(AgentPrincipal p, JsonNode a) {
            var found = store.find(p.tenant(), new BatchId(required(a, "batch_id")));
            if (found.isEmpty()) {
                throw new ToolException("No such batch");
            }
            var b = found.get().batch();
            ObjectNode out = JSON.createObjectNode();
            out.put("batch_id", b.id().value());
            out.put("value_date", b.valueDate().toString());
            out.put("recorded_at", found.get().recordedAt().toString());
            out.put("reverses", b.reverses().map(BatchId::value).orElse(""));
            var arr = out.putArray("entries");
            for (Entry e : b.entries()) {
                arr.addObject().put("account", e.account().value()).put("balance_type", e.type().name())
                        .put("direction", e.direction().name()).put("minor", e.amount().minor())
                        .put("currency", e.amount().currency().code());
            }
            return out;
        }
    }
}
