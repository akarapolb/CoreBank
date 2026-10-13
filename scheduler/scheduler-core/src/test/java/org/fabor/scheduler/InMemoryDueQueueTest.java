package org.fabor.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import org.fabor.platform.tenancy.TenantId;
import org.junit.jupiter.api.Test;

class InMemoryDueQueueTest extends DueQueueConformance {
    @Override
    protected DueQueueStore newStore() {
        return new InMemoryDueQueue();
    }

    @Test
    void taskValidation() {
        TenantId t = new TenantId("bank-a");
        assertThatThrownBy(() -> new Task(t, "", "T", "A", Instant.now(), null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Task(t, "k", "", "A", Instant.now(), null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Task(t, "k", "T", null, Instant.now(), null)).isInstanceOf(IllegalArgumentException.class);
        assertThat(new Task(t, "k", "T", "A", Instant.now(), null).payload()).isEmpty();
    }
}
