package org.fabor.ledger.testkit;

import org.fabor.ledger.application.LedgerStore;

class InMemoryLedgerStoreTest extends LedgerStoreConformance {
    @Override
    protected LedgerStore newStore() {
        return new InMemoryLedgerStore();
    }
}
