package org.fabor.lending;

import java.time.LocalDate;
import java.util.List;

/** A loan contract pinned to one product version. Amounts are minor units. */
public record Loan(String id, String party, String productCode, int productVersion, String currency,
                   String depositAccountId, LocalDate disbursedOn, long principal, List<Instalment> instalments,
                   Status status) {
    public enum Status { ACTIVE, CLOSED, NON_ACCRUAL }

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
        return new Loan(id, party, productCode, productVersion, currency, depositAccountId, disbursedOn, principal, list, s);
    }

    public Loan withStatus(Status s) {
        return withInstalments(instalments, s);
    }
}
