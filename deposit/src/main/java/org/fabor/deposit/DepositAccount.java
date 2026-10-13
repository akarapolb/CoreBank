package org.fabor.deposit;

public record DepositAccount(String id, String party, String productCode, int productVersion, String currency) {
    /** Ledger account holding the customer's balance. */
    public String ledgerId() {
        return "dep:" + id;
    }
}
