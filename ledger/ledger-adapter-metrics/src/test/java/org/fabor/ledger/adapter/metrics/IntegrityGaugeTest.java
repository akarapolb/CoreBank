package org.fabor.ledger.adapter.metrics;

import static org.assertj.core.api.Assertions.assertThat;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

class IntegrityGaugeTest {
    @Test
    void reportsLastRun() {
        SimpleMeterRegistry reg = new SimpleMeterRegistry();
        IntegrityGauge g = new IntegrityGauge(reg);
        assertThat(reg.get("fabor.ledger.integrity.failures").gauge().value()).isZero();
        g.record(2);
        assertThat(reg.get("fabor.ledger.integrity.failures").gauge().value()).isEqualTo(2.0);
    }
}
