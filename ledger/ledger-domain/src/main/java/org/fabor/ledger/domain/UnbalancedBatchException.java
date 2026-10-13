package org.fabor.ledger.domain;

import org.fabor.platform.money.Currency;

public class UnbalancedBatchException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public UnbalancedBatchException(Currency currency, long netMinor) {
        super("Batch does not balance in " + currency.code() + ": net " + netMinor);
    }
}
