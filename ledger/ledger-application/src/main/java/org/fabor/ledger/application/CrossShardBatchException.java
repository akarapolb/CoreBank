package org.fabor.ledger.application;

public class CrossShardBatchException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public CrossShardBatchException(String message) {
        super(message);
    }
}
