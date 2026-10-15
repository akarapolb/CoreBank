package org.fabor.lending;

import java.time.LocalDate;
import java.util.List;

/**
 * What a fleet customer owes under a master agreement on one day: every billed instalment of every schedule that is due
 * and not fully paid, oldest first, with the VAT of each instalment split across the vehicles of its schedule.
 * Amounts are minor units.
 */
public record ConsolidatedInvoice(String masterId, String number, LocalDate asOf, String currency, List<Line> lines,
                                  List<VehicleVat> vehicleVat, long total) {
    /** What is still owed on one instalment, by component. */
    public record Line(String loanId, int instalment, LocalDate dueDate, long principal, long interest, long penalty,
                       long vat) {
        public long total() {
            return principal + interest + penalty + vat;
        }
    }

    /** The share of an instalment's VAT that belongs to one vehicle. */
    public record VehicleVat(String loanId, int instalment, String assetId, long vat) { }
}
