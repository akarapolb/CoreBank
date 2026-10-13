package org.fabor.ledger.api;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;

/** Event payload for the {@code BatchPosted} outbox event. Mirrors {@code avro/BatchPosted.avsc}. */
public record BatchPostedEvent(String tenant, String batchId, String idempotencyKey, String valueDate,
                               String recordedAt, String reverses, List<Line> entries) {

    public static final String TYPE = "BatchPosted";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public record Line(String account, String balanceType, String direction, long minor, String currency) { }

    public String toJson() {
        ObjectNode n = MAPPER.createObjectNode();
        n.put("tenant", tenant);
        n.put("batchId", batchId);
        n.put("idempotencyKey", idempotencyKey);
        n.put("valueDate", valueDate);
        n.put("recordedAt", recordedAt);
        n.put("reverses", reverses);
        ArrayNode arr = n.putArray("entries");
        for (Line l : entries) {
            ObjectNode e = arr.addObject();
            e.put("account", l.account());
            e.put("balanceType", l.balanceType());
            e.put("direction", l.direction());
            e.put("minor", l.minor());
            e.put("currency", l.currency());
        }
        try {
            return MAPPER.writeValueAsString(n);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
