package org.fabor.ledger.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.InputStream;
import java.util.List;
import org.apache.avro.Schema;
import org.apache.avro.generic.GenericDatumReader;
import org.apache.avro.generic.GenericRecord;
import org.apache.avro.io.DecoderFactory;
import org.junit.jupiter.api.Test;

class BatchPostedEventTest {
    @Test
    void jsonConformsToAvroSchema() throws Exception {
        BatchPostedEvent e = new BatchPostedEvent("bank-a", "b1", "k1", "2026-01-01", "2026-01-01T00:00:00Z", "",
                List.of(new BatchPostedEvent.Line("gl-cash", "SETTLED", "DEBIT", 1000, "THB"),
                        new BatchPostedEvent.Line("cust-1", "SETTLED", "CREDIT", 1000, "THB")));
        try (InputStream in = getClass().getResourceAsStream("/avro/BatchPosted.avsc")) {
            Schema schema = new Schema.Parser().parse(in);
            GenericRecord r = new GenericDatumReader<GenericRecord>(schema)
                    .read(null, DecoderFactory.get().jsonDecoder(schema, e.toJson()));
            assertThat(r.get("batchId").toString()).isEqualTo("b1");
            assertThat((List<?>) r.get("entries")).hasSize(2);
        }
    }

    @Test
    void roundTripAndRejectGarbage() {
        BatchPostedEvent e = new BatchPostedEvent("bank-a", "b1", "k1", "2026-01-01", "2026-01-01T00:00:00Z", "b0",
                List.of(new BatchPostedEvent.Line("a", "SETTLED", "DEBIT", 5, "THB"),
                        new BatchPostedEvent.Line("b", "SETTLED", "CREDIT", 5, "THB")));
        assertThat(BatchPostedEvent.fromJson(e.toJson())).isEqualTo(e);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> BatchPostedEvent.fromJson("{}"))
                .isInstanceOf(IllegalArgumentException.class);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> BatchPostedEvent.fromJson("not json"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
