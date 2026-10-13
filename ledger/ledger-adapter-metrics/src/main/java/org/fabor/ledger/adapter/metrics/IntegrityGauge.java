package org.fabor.ledger.adapter.metrics;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Publishes the result of the nightly integrity check as {@code fabor_ledger_integrity_failures}
 * (number of violated checks in the last run; 0 is healthy). The alert fires on any value above 0.
 */
public final class IntegrityGauge {
    private final AtomicLong failures = new AtomicLong();

    public IntegrityGauge(MeterRegistry registry) {
        Gauge.builder("fabor.ledger.integrity.failures", failures, AtomicLong::get)
                .description("Violated ledger integrity checks in the last run").register(registry);
    }

    public void record(long violatedChecks) {
        failures.set(violatedChecks);
    }
}
