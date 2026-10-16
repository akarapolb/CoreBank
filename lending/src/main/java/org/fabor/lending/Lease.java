package org.fabor.lending;

import java.time.LocalDate;
import java.util.List;

/**
 * A lessor-side lease contract (TFRS 16). Amounts are minor units. A finance lease carries the net investment in the
 * lease; an operating lease keeps the asset on the lessor's books. Each period is accrued once its due date has
 * passed (income is earned whether or not the customer has paid) and collected separately.
 */
public record Lease(String id, String party, Kind kind, String currency, String depositAccountId, LocalDate startDate,
                    long assetCost, long residual, List<Period> periods, Status status) {
    public enum Kind { FINANCE, OPERATING }

    public enum Status { ACTIVE, COMPLETED, TERMINATED, PURCHASED }

    /**
     * @param payment          what the customer pays for the period (rent), excluding VAT
     * @param income           finance lease: finance income earned in the period
     * @param rentRecognised   operating lease: straight-line rent recognised in the period
     * @param depreciation     operating lease: depreciation charged in the period
     */
    public record Period(int number, LocalDate dueDate, long payment, long income, long rentRecognised, long depreciation,
                         boolean accrued, long paid) {
        /** What the customer owes now for the period: zero until it is accrued. */
        public long outstanding() {
            return accrued ? payment - paid : 0;
        }
    }

    public Lease withPeriods(List<Period> list, Status s) {
        return new Lease(id, party, kind, currency, depositAccountId, startDate, assetCost, residual, list, s);
    }
}
