package org.fabor.lending;

import java.time.LocalDate;

/**
 * One drawdown of a floor plan line: a vehicle bought from the distributor. Amounts are minor units. Interest is accrued
 * through {@code interestThrough}; {@code subvention} is the interest of the interest-free period, which the manufacturer
 * bears and which is not part of what the dealer owes.
 */
public record FloorPlanUnit(String lineId, String unitId, FloorPlanLine.UnitType type, long drawn, long principalPaid,
                            LocalDate drawnOn, LocalDate interestThrough, long interestAccrued, long interestPaid,
                            long subvention, LocalDate soldOn, Status status) {
    public enum Status { OPEN, PAID }

    public long principalOutstanding() {
        return drawn - principalPaid;
    }

    public long interestOutstanding() {
        return interestAccrued - interestPaid;
    }

    public FloorPlanUnit withAccrual(LocalDate through, long charged, long borneByManufacturer) {
        return new FloorPlanUnit(lineId, unitId, type, drawn, principalPaid, drawnOn, through, interestAccrued + charged,
                interestPaid, subvention + borneByManufacturer, soldOn, status);
    }

    public FloorPlanUnit withPayment(long interest, long principal) {
        FloorPlanUnit paid = new FloorPlanUnit(lineId, unitId, type, drawn, principalPaid + principal, drawnOn, interestThrough,
                interestAccrued, interestPaid + interest, subvention, soldOn, status);
        return paid.principalOutstanding() == 0 && paid.interestOutstanding() == 0 ? paid.withStatus(Status.PAID) : paid;
    }

    public FloorPlanUnit withSale(LocalDate sold) {
        return new FloorPlanUnit(lineId, unitId, type, drawn, principalPaid, drawnOn, interestThrough, interestAccrued,
                interestPaid, subvention, sold, status);
    }

    private FloorPlanUnit withStatus(Status s) {
        return new FloorPlanUnit(lineId, unitId, type, drawn, principalPaid, drawnOn, interestThrough, interestAccrued,
                interestPaid, subvention, soldOn, s);
    }
}
