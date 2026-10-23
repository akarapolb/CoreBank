package org.fabor.lending;

import java.time.LocalDate;

/**
 * One thing that happened on a delinquent loan: an attempt to reach the customer, or a promise to pay. {@code reference}
 * is chosen by the caller and unique per loan, so a retried request does not record twice. Amounts are minor units.
 *
 * @param channel            for a contact, how the customer was approached
 * @param promisedAmount     for a promise, what the customer undertook to pay (zero otherwise)
 * @param payBy              for a promise, the date by which it is to be paid (null otherwise)
 * @param overdueAtPromise   for a promise, what was overdue when it was made, to tell afterwards whether it was kept
 */
public record CollectionEvent(String loanId, String reference, LocalDate date, Kind kind, Channel channel, String note,
                              long promisedAmount, LocalDate payBy, long overdueAtPromise) {
    public enum Kind { CONTACT, PROMISE }

    public enum Channel { CALL, SMS, LETTER, VISIT, EMAIL, NONE }
}
