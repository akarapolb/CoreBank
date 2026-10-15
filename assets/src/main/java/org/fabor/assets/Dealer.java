package org.fabor.assets;

import java.math.BigDecimal;

/** A dealer or supplier that sells assets to be financed. {@code commissionRate} is a fraction of the asset cost (0.02 = 2%). */
public record Dealer(String id, String name, String taxId, Status status, BigDecimal commissionRate) {
    public enum Status { ACTIVE, SUSPENDED }

    public Dealer {
        if (id == null || id.isBlank() || name == null || name.isBlank() || taxId == null || taxId.isBlank()) {
            throw new IllegalArgumentException("A dealer needs an id, a name and a tax id");
        }
        if (commissionRate == null || commissionRate.signum() < 0 || commissionRate.compareTo(new BigDecimal("0.20")) > 0) {
            throw new IllegalArgumentException("Commission rate must be between 0 and 0.20");
        }
    }

    public Dealer withStatus(Status s) {
        return new Dealer(id, name, taxId, s, commissionRate);
    }
}
