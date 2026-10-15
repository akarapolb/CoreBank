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
        return named("retail_th_v1")
                .rule("dep:.*", "2100", "Customer deposits", GlAccount.Type.LIABILITY)
                .rule("loan:.*:principal", "1300", "Loans receivable", GlAccount.Type.ASSET)
                .rule("loan:.*:interest", "1310", "Interest receivable", GlAccount.Type.ASSET)
                .rule("loan:.*:penalty", "1320", "Penalties receivable", GlAccount.Type.ASSET)
                .rule("loan:.*:vat", "1330", "VAT receivable on instalments", GlAccount.Type.ASSET)
                .rule("gl:(deposit-clearing|cash)", "1100", "Cash and clearing", GlAccount.Type.ASSET)
                .rule("gl:wht-payable", "2300", "Withholding tax payable", GlAccount.Type.LIABILITY)
                .rule("gl:vat-payable", "2310", "VAT payable", GlAccount.Type.LIABILITY)
                .rule("gl:interest-suspense", "2400", "Interest in suspense", GlAccount.Type.LIABILITY)
                .rule("gl:interest-income", "4100", "Interest income", GlAccount.Type.INCOME)
                .rule("gl:fee-income", "4200", "Fee income", GlAccount.Type.INCOME)
                .rule("gl:penalty-income", "4300", "Penalty income", GlAccount.Type.INCOME)
                .rule("gl:interest-expense", "5100", "Interest expense", GlAccount.Type.EXPENSE)
                .build();
    }
}
