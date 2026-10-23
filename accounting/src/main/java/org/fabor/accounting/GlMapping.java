package org.fabor.accounting;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Maps ledger account ids to general-ledger accounts. First matching rule wins. A mapping is versioned
 * configuration: changing it affects only postings from then on, because the projection records the GL code at
 * the time each event is applied.
 */
public final class GlMapping {
    private record Rule(Pattern pattern, GlAccount account) { }

    private final String name;
    private final List<Rule> rules;

    private GlMapping(String name, List<Rule> rules) {
        this.name = name;
        this.rules = rules;
    }

    public String name() {
        return name;
    }

    public GlAccount map(String ledgerAccountId) {
        for (Rule r : rules) {
            if (r.pattern().matcher(ledgerAccountId).matches()) {
                return r.account();
            }
        }
        throw new IllegalArgumentException("No GL mapping for ledger account " + ledgerAccountId);
    }

    public static Builder named(String name) {
        return new Builder(name);
    }

    public static final class Builder {
        private final String name;
        private final List<Rule> rules = new ArrayList<>();

        private Builder(String name) {
            this.name = name;
        }

        public Builder rule(String regex, String code, String glName, GlAccount.Type type) {
            rules.add(new Rule(Pattern.compile(regex), new GlAccount(code, glName, type)));
            return this;
        }

        public GlMapping build() {
            return new GlMapping(name, List.copyOf(rules));
        }
    }

    /** Standard Phase 1 chart for retail deposits and personal loans. */
    public static GlMapping retailV1() {
        return retailRules(named("retail_th_v1")).build();
    }

    /**
     * The retail chart plus lessor accounts for TFRS 16 finance and operating leases: net investment in leases, rent
     * receivable, accrued (deferred) rent, assets under operating leases with their accumulated depreciation, supplier
     * payable, finance and rental income and depreciation expense.
     */
    public static GlMapping leaseTfrs16V1() {
        return leaseRules(retailRules(named("lease_tfrs16_v1"))).build();
    }

    /**
     * The lease chart plus floor plan financing: floor plan principal and interest receivable per unit, and the
     * manufacturer's subvention receivable.
     */
    public static GlMapping assetFinanceV1() {
        return leaseRules(retailRules(named("asset_finance_v1")))
                .rule("fp:.*:.*:principal", "1350", "Floor plan receivable", GlAccount.Type.ASSET)
                .rule("fp:.*:.*:interest", "1360", "Floor plan interest receivable", GlAccount.Type.ASSET)
                .rule("gl:oem-subvention-receivable", "1370", "Manufacturer subvention receivable", GlAccount.Type.ASSET)
                .build();
    }

    private static Builder leaseRules(Builder b) {
        return b
                .rule("lease:.*:net-investment", "1400", "Net investment in finance leases", GlAccount.Type.ASSET)
                .rule("lease:.*:rent-receivable", "1410", "Operating lease rent receivable", GlAccount.Type.ASSET)
                .rule("lease:.*:accrued-rent", "1420", "Accrued (deferred) rent, net", GlAccount.Type.ASSET)
                .rule("gl:dealer-commission-deferred", "1430", "Deferred dealer commission", GlAccount.Type.ASSET)
                .rule("gl:leased-assets", "1500", "Assets under operating leases", GlAccount.Type.ASSET)
                .rule("gl:accumulated-depreciation", "1590", "Accumulated depreciation, leased assets", GlAccount.Type.ASSET)
                .rule("gl:supplier-payable", "2200", "Supplier payable", GlAccount.Type.LIABILITY)
                .rule("gl:finance-income", "4400", "Finance lease income", GlAccount.Type.INCOME)
                .rule("gl:rental-income", "4410", "Operating lease rental income", GlAccount.Type.INCOME)
                .rule("gl:depreciation-expense", "5200", "Depreciation, leased assets", GlAccount.Type.EXPENSE);
    }

    private static Builder retailRules(Builder b) {
        return b
                .rule("dep:.*", "2100", "Customer deposits", GlAccount.Type.LIABILITY)
                .rule("loan:.*:principal", "1300", "Loans receivable", GlAccount.Type.ASSET)
                .rule("loan:.*:interest", "1310", "Interest receivable", GlAccount.Type.ASSET)
                .rule("loan:.*:penalty", "1320", "Penalties receivable", GlAccount.Type.ASSET)
                .rule("loan:.*:vat", "1330", "VAT receivable on instalments", GlAccount.Type.ASSET)
                .rule("loan:.*:ecl-allowance", "1390", "Loss allowance on loans (contra asset)", GlAccount.Type.ASSET)
                .rule("gl:(deposit-clearing|cash)", "1100", "Cash and clearing", GlAccount.Type.ASSET)
                .rule("gl:wht-payable", "2300", "Withholding tax payable", GlAccount.Type.LIABILITY)
                .rule("gl:vat-payable", "2310", "VAT payable", GlAccount.Type.LIABILITY)
                .rule("gl:interest-suspense", "2400", "Interest in suspense", GlAccount.Type.LIABILITY)
                .rule("gl:interest-income", "4100", "Interest income", GlAccount.Type.INCOME)
                .rule("gl:fee-income", "4200", "Fee income", GlAccount.Type.INCOME)
                .rule("gl:penalty-income", "4300", "Penalty income", GlAccount.Type.INCOME)
                .rule("gl:interest-expense", "5100", "Interest expense", GlAccount.Type.EXPENSE)
                .rule("gl:ecl-expense", "5300", "Expected credit loss expense", GlAccount.Type.EXPENSE);
    }
}
