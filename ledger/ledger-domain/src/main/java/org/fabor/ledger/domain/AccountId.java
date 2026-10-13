package org.fabor.ledger.domain;

public record AccountId(String value) {
    public AccountId {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Account id required");
        }
    }
}
