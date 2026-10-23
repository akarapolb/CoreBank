package org.fabor.assets;

/**
 * An asset financed or leased by the bank. Amounts are minor units. {@code contractId} is the loan or lease the asset
 * secures, set when the asset becomes active. Title stays with the lessor until the contract is paid off.
 */
public record Asset(String id, Kind kind, String make, String model, String serialNo, String engineNo,
                    String registrationNo, String dealerId, String currency, long cost, String contractId, Status status,
                    String location, Condition condition, TitleHolder titleHolder) {
    public enum Kind { VEHICLE, EQUIPMENT }

    /**
     * ORDERED from the dealer, DELIVERED (and registered), ACTIVE under a contract, RETURNED to the lessor, REPOSSESSED
     * from a customer in default (awaiting sale), DISPOSED of.
     */
    public enum Status { ORDERED, DELIVERED, ACTIVE, RETURNED, REPOSSESSED, DISPOSED }

    public enum Condition { NEW, GOOD, FAIR, POOR, DAMAGED }

    public enum TitleHolder { LESSOR, CUSTOMER }

    public Asset withStatus(Status s) {
        return new Asset(id, kind, make, model, serialNo, engineNo, registrationNo, dealerId, currency, cost, contractId, s,
                location, condition, titleHolder);
    }

    public Asset withDelivery(String engine, String registration) {
        return new Asset(id, kind, make, model, serialNo, engine, registration, dealerId, currency, cost, contractId,
                Status.DELIVERED, location, condition, titleHolder);
    }

    public Asset withContract(String contract) {
        return new Asset(id, kind, make, model, serialNo, engineNo, registrationNo, dealerId, currency, cost, contract,
                Status.ACTIVE, location, condition, titleHolder);
    }

    public Asset withLocation(String where) {
        return new Asset(id, kind, make, model, serialNo, engineNo, registrationNo, dealerId, currency, cost, contractId,
                status, where, condition, titleHolder);
    }

    public Asset withCondition(Condition c) {
        return new Asset(id, kind, make, model, serialNo, engineNo, registrationNo, dealerId, currency, cost, contractId,
                status, location, c, titleHolder);
    }

    public Asset withTitleTransferred() {
        return new Asset(id, kind, make, model, serialNo, engineNo, registrationNo, dealerId, currency, cost, contractId,
                Status.DISPOSED, location, condition, TitleHolder.CUSTOMER);
    }
}
