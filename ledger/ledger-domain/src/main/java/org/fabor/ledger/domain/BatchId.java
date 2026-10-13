package org.fabor.ledger.domain;

public record BatchId(String value) {
    public BatchId {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Batch id required");
        }
    }
}
