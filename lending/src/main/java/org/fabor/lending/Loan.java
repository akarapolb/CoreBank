package org.fabor.lending;

import java.time.LocalDate;
import java.util.List;

/** A loan contract pinned to one product version. Amounts are minor units. */
public record Loan(String id, String party, String productCode, int productVersion, String currency,
                   String depositAccountId, LocalDate disbursedOn, long principal, List<Instalment> instalments,
                   Status status, java.math.BigDecimal rateOverride, int generation) {
    public enum Status { ACTIVE, CLOSED, NON_ACCRUAL, WRITTEN_OFF }

    /** A loan on its product's own rate. {@code rateOverride} is set only by restructuring. */
    public Loan(String id, String party, String productCode, int productVersion, String currency, String depositAccountId,
                LocalDate disbursedOn, long principal, List<Instalment> instalments, Status status) {
        this(id, party, productCode, productVersion, currency, depositAccountId, disbursedOn, principal, instalments, status, null, 0);
    }

    /**
     * One scheduled instalment and what has been done with it. {@code vatDue} is the VAT added to the customer's bill when
     * the instalment is billed (zero for products that charge no VAT on instalments).
     */
    public record Instalment(int number, LocalDate dueDate, long principalDue, long interestDue, long principalPaid,
                             long interestPaid, long penaltyAccrued, long penaltyPaid, boolean billed, long vatDue,
                             long vatPaid) {
        /** An instalment without VAT. */
        public Instalment(int number, LocalDate dueDate, long principalDue, long interestDue, long principalPaid,
                          long interestPaid, long penaltyAccrued, long penaltyPaid, boolean billed) {
            this(number, dueDate, principalDue, interestDue, principalPaid, interestPaid, penaltyAccrued, penaltyPaid,
                    billed, 0, 0);
        }

        public long principalOutstanding() {
            return principalDue - principalPaid;
        }

        public long interestOutstanding() {
            return interestDue - interestPaid;
        }

        public long penaltyOutstanding() {
            return penaltyAccrued - penaltyPaid;
        }

        public long vatOutstanding() {
            return vatDue - vatPaid;
        }

        public long outstanding() {
            return principalOutstanding() + interestOutstanding() + penaltyOutstanding() + vatOutstanding();
        }

        public boolean settled() {
            return billed && outstanding() == 0;
        }

        /** The same instalment, billed, with the VAT that billing added. */
        public Instalment withBilled(long vat) {
            return new Instalment(number, dueDate, principalDue, interestDue, principalPaid, interestPaid, penaltyAccrued,
                    penaltyPaid, true, vat, vatPaid);
        }

        /** The same instalment with these amounts paid on top of what was already paid. */
        public Instalment withPaid(long principal, long interest, long penalty, long vat) {
            return new Instalment(number, dueDate, principalDue, interestDue, principalPaid + principal,
                    interestPaid + interest, penaltyAccrued, penaltyPaid + penalty, billed, vatDue, vatPaid + vat);
        }

        /** The same instalment with this much extra late charge accrued. */
        public Instalment withPenalty(long extra) {
            return new Instalment(number, dueDate, principalDue, interestDue, principalPaid, interestPaid,
                    penaltyAccrued + extra, penaltyPaid, billed, vatDue, vatPaid);
        }
    }

    public Loan withInstalments(List<Instalment> list, Status s) {
        return new Loan(id, party, productCode, productVersion, currency, depositAccountId, disbursedOn, principal, list, s, rateOverride, generation);
    }

    public Loan withStatus(Status s) {
        return withInstalments(instalments, s);
    }

    /** Prefix for system-generated posting ids once the schedule has been replaced by a restructuring. */
    public String tag() {
        return generation == 0 ? "" : "g" + generation + "-";
    }

    public Loan withRate(java.math.BigDecimal rate) {
        return new Loan(id, party, productCode, productVersion, currency, depositAccountId, disbursedOn, principal, instalments, status, rate, generation + 1);
    }
}
