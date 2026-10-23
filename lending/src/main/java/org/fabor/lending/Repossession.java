package org.fabor.lending;

import java.time.LocalDate;

/**
 * A repossession case: the asset taken back from a customer in default and, once sold, what the sale did to the debt.
 * Amounts are minor units. {@code reference} is chosen by the caller and unique, so a retry does not repeat.
 *
 * @param owed       what the loan stood at on the sale date (the settlement quote)
 * @param shortfall  what the sale left unpaid: written off, with the rest tracked as a recovery claim on the customer
 * @param surplus    what the sale left over after clearing the debt, which stays in the customer's deposit account
 */
public record Repossession(String reference, String loanId, String assetId, LocalDate repossessedOn, String location,
                           Status status, LocalDate soldOn, long proceeds, long costs, long owed, long shortfall,
                           long surplus) {
    public enum Status { OPEN, SOLD }

    public Repossession sold(LocalDate on, long proceeds, long costs, long owed, long shortfall, long surplus) {
        return new Repossession(reference, loanId, assetId, repossessedOn, location, Status.SOLD, on, proceeds, costs, owed,
                shortfall, surplus);
    }
}
