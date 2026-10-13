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

    /** One scheduled instalment and what has been done with it. */
    public record Instalment(int number, LocalDate dueDate, long principalDue, long interestDue, long principalPaid,
                             long interestPaid, long penaltyAccrued, long penaltyPaid, boolean billed) {
        public long principalOutstanding() {
            return principalDue - principalPaid;
        }

        public long interestOutstanding() {
            return interestDue - interestPaid;
        }

        public long penaltyOutstanding() {
            return penaltyAccrued - penaltyPaid;
        }

        public long outstanding() {
            return principalOutstanding() + interestOutstanding() + penaltyOutstanding();
        }

        public boolean settled() {
            return billed && outstanding() == 0;
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
