package org.fabor.ledger.domain;

/** Balance buckets tracked per account. Contingent types support off-balance-sheet obligations. */
public enum BalanceType {
    SETTLED, PENDING, HOLD, CONTINGENT
}
