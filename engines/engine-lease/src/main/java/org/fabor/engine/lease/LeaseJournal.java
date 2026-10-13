package org.fabor.engine.lease;

import java.util.List;
import org.fabor.platform.money.Money;

/** Journal plans for lessor accounting, as data. The accounting service maps the account codes to GL accounts. */
public final class LeaseJournal {
    public record Line(String debit, String credit, Money amount, String memo) { }

    private LeaseJournal() { }

    public static List<Line> financeLeaseInception(Money netInvestment) {
        return List.of(new Line("NET_INVESTMENT_IN_LEASE", "SUPPLIER_PAYABLE", netInvestment, "Finance lease inception"));
    }

    /** A period of a finance lease: income is recognised, the payment is received. */
    public static List<Line> financeLeasePeriod(FinanceLease.Row r) {
        return List.of(
                new Line("NET_INVESTMENT_IN_LEASE", "FINANCE_INCOME", r.income(), "Finance income period " + r.period()),
                new Line("CASH", "NET_INVESTMENT_IN_LEASE", r.payment(), "Lease payment period " + r.period()));
    }

    public static List<Line> operatingLeaseInception(Money cost) {
        return List.of(new Line("LEASED_ASSETS", "SUPPLIER_PAYABLE", cost, "Operating lease inception"));
    }

    public static List<Line> operatingLeasePeriod(OperatingLease.Row r) {
        Money billed = r.billedRent();
        Money recognised = r.recognisedRent();
        List<Line> lines = new java.util.ArrayList<>();
        lines.add(new Line("CASH", "RENTAL_INCOME", billed, "Rent billed period " + r.period()));
        Money diff = recognised.minus(billed);
        if (diff.minor() > 0) {
            lines.add(new Line("ACCRUED_RENT", "RENTAL_INCOME", diff, "Straight-line adjustment"));
        } else if (diff.minor() < 0) {
            lines.add(new Line("RENTAL_INCOME", "DEFERRED_RENT", diff.negate(), "Straight-line adjustment"));
        }
        lines.add(new Line("DEPRECIATION_EXPENSE", "ACCUMULATED_DEPRECIATION", r.depreciation(), "Depreciation period " + r.period()));
        return List.copyOf(lines);
    }
}
