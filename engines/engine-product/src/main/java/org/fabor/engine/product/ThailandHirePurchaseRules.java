package org.fabor.engine.product;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.fabor.engine.schedule.RebateRule;

/**
 * Thai vehicle hire-purchase rules, v1 subset, applied to products whose segment names a vehicle class
 * ({@code NEW_CAR}, {@code USED_CAR}, {@code MOTORCYCLE}):
 * <ul>
 *   <li>interest is charged on the principal still outstanding, so flat-rate pricing is an error;</li>
 *   <li>the annual rate on the outstanding balance may not exceed the class ceiling;</li>
 *   <li>early settlement must excuse at least the minimum share of the interest not yet due, which grows with the
 *       share of the term already paid.</li>
 * </ul>
 * Defaults follow the Contract Committee notification in force from 10 January 2023 as reported by law-firm
 * summaries (10% new car, 15% used car, 23% motorcycle; rebate of at least 60%, 70% and 100% of the interest not yet
 * due at up to a third, up to two thirds and beyond two thirds of the term paid). They are configuration: the Bank of
 * Thailand has since taken over supervision (Notification 55/2568) and the figures must be confirmed against the
 * current text with counsel before production use.
 */
public final class ThailandHirePurchaseRules implements RulePack {
    public static final Map<String, BigDecimal> DEFAULT_CEILINGS = Map.of(
            "NEW_CAR", new BigDecimal("0.10"),
            "USED_CAR", new BigDecimal("0.15"),
            "MOTORCYCLE", new BigDecimal("0.23"));
    public static final List<BigDecimal> DEFAULT_MIN_REBATE = List.of(
            new BigDecimal("0.60"), new BigDecimal("0.70"), BigDecimal.ONE);

    private final Map<String, BigDecimal> ceilings;
    private final List<BigDecimal> minRebate;

    public ThailandHirePurchaseRules() {
        this(DEFAULT_CEILINGS, DEFAULT_MIN_REBATE);
    }

    public ThailandHirePurchaseRules(Map<String, BigDecimal> ceilings, List<BigDecimal> minRebate) {
        if (minRebate.size() != 3) {
            throw new IllegalArgumentException("minRebate needs three tiers");
        }
        this.ceilings = Map.copyOf(ceilings);
        this.minRebate = List.copyOf(minRebate);
    }

    @Override
    public String id() {
        return "TH-HP-VEHICLE-v1";
    }

    @Override
    public List<Issue> check(ProductDefinition d) {
        List<Issue> out = new ArrayList<>();
        BigDecimal ceiling = ceiling(d);
        if (ceiling == null || !"THB".equals(d.currency()) || d.pricing() == null) {
            return out;
        }
        if (d.pricing().rateType() == ProductDefinition.RateType.FLAT) {
            out.add(Issue.error("pricing.rate_type", "Vehicle hire purchase must charge interest on the outstanding "
                    + "principal; flat-rate pricing is not allowed"));
        }
        BigDecimal rate = d.pricing().rate();
        if (rate != null && rate.compareTo(ceiling) > 0) {
            out.add(Issue.error("pricing.rate", "Rate " + rate + " exceeds the " + ceiling + " ceiling for "
                    + segmentOf(d)));
        } else if (rate != null && d.schedule() != null && "MONTHLY".equals(d.schedule().frequency())) {
            BigDecimal compounded = org.fabor.engine.interest.Rates.effectiveAnnual(
                    org.fabor.engine.interest.Rates.periodic(rate, 12), 12);
            if (compounded.compareTo(ceiling) > 0) {
                out.add(Issue.warning("pricing.rate", "Monthly compounding makes the effective annual rate "
                        + compounded.setScale(4, RoundingMode.HALF_UP) + ", above the " + ceiling
                        + " ceiling; confirm which measure the rule uses"));
            }
        }
        rebate(d, out);
        return out;
    }

    private void rebate(ProductDefinition d, List<Issue> out) {
        var es = d.earlySettlement();
        if (es == null || es.rebate() == null || "NONE".equals(es.rebate().trim())) {
            out.add(Issue.error("early_settlement.rebate", "Vehicle hire purchase must state an early-settlement rebate"));
            return;
        }
        RebateRule rule;
        try {
            rule = RebateRule.parse(es.rebate());
        } catch (IllegalArgumentException e) {
            out.add(Issue.error("early_settlement.rebate", e.getMessage()));
            return;
        }
        if (rule.kind() == RebateRule.Kind.RULE_OF_78) {
            out.add(Issue.error("early_settlement.rebate", "RULE_OF_78 cannot be shown to meet the minimum rebate; "
                    + "use ACTUARIAL or TIERED"));
            return;
        }
        // sample at one third, two thirds and beyond of a 36-instalment term
        int[] remaining = {24, 12, 6};
        List<String> shortfalls = new ArrayList<>();
        for (int t = 0; t < 3; t++) {
            if (rule.fractionAt(36, remaining[t]).compareTo(minRebate.get(t)) < 0) {
                shortfalls.add(minRebate.get(t) + " at " + (36 - remaining[t]) + " of 36 instalments paid");
            }
        }
        if (!shortfalls.isEmpty()) {
            out.add(Issue.error("early_settlement.rebate", "Rebate of the interest not yet due is below the minimum: "
                    + String.join("; ", shortfalls)));
        }
    }

    private BigDecimal ceiling(ProductDefinition d) {
        if (d.segment() == null) {
            return null;
        }
        return d.segment().stream().map(ceilings::get).filter(java.util.Objects::nonNull).min(BigDecimal::compareTo)
                .orElse(null);
    }

    private static String segmentOf(ProductDefinition d) {
        return String.join("/", d.segment());
    }
}
