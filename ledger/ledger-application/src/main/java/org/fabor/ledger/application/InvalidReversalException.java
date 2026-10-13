package org.fabor.ledger.application;

public class InvalidReversalException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public InvalidReversalException(String message) {
        super(message);
    }
}
