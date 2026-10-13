package org.fabor.platform.tenancy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class TenancyTest {
    @Test
    void validTenant() {
        assertThat(new TenantId("bank-th-1").value()).isEqualTo("bank-th-1");
    }

    @Test
    void invalidTenants() {
        assertThatThrownBy(() -> new TenantId("Bad Name")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new TenantId(null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void keyRules() {
        assertThat(new IdempotencyKey("k1").value()).isEqualTo("k1");
        assertThatThrownBy(() -> new IdempotencyKey(" ")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new IdempotencyKey(null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new IdempotencyKey("x".repeat(129))).isInstanceOf(IllegalArgumentException.class);
    }
}
