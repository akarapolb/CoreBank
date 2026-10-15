package org.fabor.lending;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * A fleet master agreement: the commercial terms under which a business customer draws many schedules (call-offs), each
 * a loan of its own. Amounts are minor units. {@code crossDefaultDpd} is the days past due on any schedule at which the
 * whole agreement is in default.
 */
public record MasterAgreement(String id, String party, String currency, long limit, String productCode, int productVersion,
                              int crossDefaultDpd, List<RateCardRow> rateCard, Status status, LocalDate signedOn) {
    public enum Status { ACTIVE, DEFAULTED, CLOSED }

    /** The rate for a vehicle class and a range of terms, valid from a date (and until one, if given). */
    public record RateCardRow(String vehicleClass, int minTerm, int maxTerm, BigDecimal rate, LocalDate validFrom,
                              LocalDate validTo) {
        public RateCardRow {
            if (vehicleClass == null || vehicleClass.isBlank() || minTerm < 1 || maxTerm < minTerm || rate == null
                    || rate.signum() < 0 || rate.compareTo(BigDecimal.ONE) > 0 || validFrom == null
                    || (validTo != null && validTo.isBefore(validFrom))) {
                throw new IllegalArgumentException("Invalid rate card row");
            }
        }

        boolean applies(String cls, int term, LocalDate day) {
            return vehicleClass.equals(cls) && term >= minTerm && term <= maxTerm && !day.isBefore(validFrom)
                    && (validTo == null || !day.isAfter(validTo));
        }
    }

    /**
     * One call-off: a loan drawn under the agreement at the rate locked from the rate card on the day. {@code assetIds}
     * are the vehicles it finances.
     */
    public record Schedule(String masterId, String loanId, String vehicleClass, BigDecimal lockedRate, int term,
                           LocalDate calledOffOn, List<String> assetIds) { }

    public MasterAgreement {
        if (limit <= 0 || crossDefaultDpd < 1 || rateCard == null || rateCard.isEmpty()) {
            throw new IllegalArgumentException("A master agreement needs a positive limit, a cross-default day count and a rate card");
        }
    }

    /** The rate that applies on {@code day}: the row that starts latest among those that match. */
    public java.util.Optional<RateCardRow> rateFor(String vehicleClass, int term, LocalDate day) {
        return rateCard.stream().filter(r -> r.applies(vehicleClass, term, day))
                .max(java.util.Comparator.comparing(RateCardRow::validFrom));
    }

    public MasterAgreement withStatus(Status s) {
        return new MasterAgreement(id, party, currency, limit, productCode, productVersion, crossDefaultDpd, rateCard, s, signedOn);
    }
}
