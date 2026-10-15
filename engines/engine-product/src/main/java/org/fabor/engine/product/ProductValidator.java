package org.fabor.engine.product;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.fabor.engine.product.ProductDefinition.Family;
import org.fabor.engine.product.ProductDefinition.Param;
import org.fabor.engine.product.ProductDefinition.RateType;
import org.fabor.engine.schedule.Frequency;
import org.fabor.engine.schedule.Method;
import org.fabor.engine.schedule.RebateRule;
import org.fabor.platform.money.Currency;

/** Structural and semantic checks that do not depend on a jurisdiction (those live in rule packs). */
public final class ProductValidator {
    public static final List<String> FEE_VARIABLES = List.of("principal", "term", "overdue", "outstanding");
    private static final Set<String> WATERFALL = Set.of("FEES_DUE", "PENALTY_DUE", "VAT_DUE", "INTEREST_DUE", "PRINCIPAL_DUE");
    private static final Set<String> FEE_TRIGGERS = Set.of("DISBURSEMENT", "MONTHLY", "ANNUAL", "DAILY_WHILE_OVERDUE",
            "EARLY_SETTLEMENT", "ON_REQUEST");

    private ProductValidator() { }

    public static List<Issue> validate(ProductDefinition d) {
        List<Issue> out = new ArrayList<>();
        if (d.product() == null || !d.product().matches("[A-Z][A-Z0-9_]{2,40}")) {
            out.add(Issue.error("product", "Code must be 3-41 characters: upper-case letters, digits, underscore"));
        }
        if (d.version() == null || d.version() < 1) {
            out.add(Issue.error("version", "Version must be 1 or more"));
        }
        if (d.family() == null) {
            out.add(Issue.error("family", "Family is required"));
        }
        if (d.currency() == null) {
            out.add(Issue.error("currency", "Currency is required"));
        } else {
            try {
                Currency.of(d.currency());
            } catch (IllegalArgumentException e) {
                out.add(Issue.error("currency", "Unknown currency " + d.currency()));
            }
        }
        parameters(d, out);
        boolean lending = d.family() != null && d.family() != Family.DEPOSIT;
        pricing(d, lending, out);
        schedule(d, lending, out);
        fees(d, out);
        waterfall(d, lending, out);
        tax(d, out);
        earlySettlement(d, out);
        delinquency(d, lending, out);
        deposit(d, out);
        if (d.accounting() == null || d.accounting().glMapping() == null || d.accounting().glMapping().isBlank()) {
            out.add(Issue.error("accounting.gl_mapping", "A GL mapping is required"));
        }
        return out;
    }

    public static boolean ok(List<Issue> issues) {
        return issues.stream().noneMatch(i -> i.severity() == Issue.Severity.ERROR);
    }

    private static void parameters(ProductDefinition d, List<Issue> out) {
        if (d.parameters() == null) {
            return;
        }
        d.parameters().forEach((name, p) -> {
            String path = "parameters." + name;
            if (p == null) {
                out.add(Issue.error(path, "Empty parameter"));
                return;
            }
            boolean hasRange = p.min() != null || p.max() != null;
            if (hasRange && p.allowed() != null) {
                out.add(Issue.error(path, "Use either min/max or allowed, not both"));
            }
            if (p.min() != null && p.max() != null && p.min().compareTo(p.max()) > 0) {
                out.add(Issue.error(path, "min is above max"));
            }
            if (p.allowed() != null && p.allowed().isEmpty()) {
                out.add(Issue.error(path, "allowed must not be empty"));
            }
            if (p.defaultValue() != null && !permits(p, p.defaultValue())) {
                out.add(Issue.error(path + ".default", "Default is outside the permitted values"));
            }
        });
    }

    /** True if the value satisfies the parameter's range or allowed list. */
    public static boolean permits(Param p, BigDecimal v) {
        if (p.allowed() != null) {
            return p.allowed().stream().anyMatch(a -> a.compareTo(v) == 0);
        }
        return (p.min() == null || v.compareTo(p.min()) >= 0) && (p.max() == null || v.compareTo(p.max()) <= 0);
    }

    private static void pricing(ProductDefinition d, boolean lending, List<Issue> out) {
        var p = d.pricing();
        if (p == null) {
            out.add(Issue.error("pricing", "Pricing is required"));
            return;
        }
        if (p.rateType() == null) {
            out.add(Issue.error("pricing.rate_type", "rate_type is required"));
            return;
        }
        boolean fixedLike = p.rateType() == RateType.FLAT || p.rateType() == RateType.FIXED;
        if (fixedLike && p.rate() == null && p.rateTable() == null) {
            out.add(Issue.error("pricing.rate", p.rateType() + " pricing needs a rate or a rate_table"));
        }
        if (p.rate() != null && (p.rate().signum() < 0 || p.rate().compareTo(BigDecimal.ONE) > 0)) {
            out.add(Issue.error("pricing.rate", "Rate must be between 0 and 1 (e.g. 0.18 for 18%)"));
        }
        if (p.dayCount() != null) {
            try {
                org.fabor.platform.time.DayCount.valueOf(p.dayCount());
            } catch (IllegalArgumentException e) {
                out.add(Issue.error("pricing.day_count", "Unknown day count " + p.dayCount()));
            }
        }
        if (lending && d.schedule() != null && d.schedule().method() != null) {
            boolean flatMethod = Method.ANNUITY_FROM_FLAT.name().equals(d.schedule().method());
            if (flatMethod && p.rateType() != RateType.FLAT) {
                out.add(Issue.error("schedule.method", "ANNUITY_FROM_FLAT needs rate_type FLAT"));
            }
            if (p.rateType() == RateType.FLAT && !flatMethod) {
                out.add(Issue.error("pricing.rate_type", "FLAT pricing needs schedule method ANNUITY_FROM_FLAT"));
            }
        }
    }

    private static void schedule(ProductDefinition d, boolean lending, List<Issue> out) {
        var s = d.schedule();
        if (!lending) {
            return;
        }
        if (s == null) {
            out.add(Issue.error("schedule", "Lending products need a schedule"));
            return;
        }
        try {
            Method.valueOf(String.valueOf(s.method()));
        } catch (IllegalArgumentException e) {
            out.add(Issue.error("schedule.method", "Unknown method " + s.method() + "; use one of "
                    + java.util.Arrays.toString(Method.values())));
        }
        try {
            Frequency.valueOf(String.valueOf(s.frequency()));
        } catch (IllegalArgumentException e) {
            out.add(Issue.error("schedule.frequency", "Unknown frequency " + s.frequency()));
        }
        if (s.holidayRule() != null) {
            try {
                org.fabor.platform.time.BusinessCalendar.Convention.valueOf(s.holidayRule());
            } catch (IllegalArgumentException e) {
                out.add(Issue.error("schedule.holiday_rule", "Unknown holiday rule " + s.holidayRule()));
            }
        }
    }

    private static void fees(ProductDefinition d, List<Issue> out) {
        if (d.fees() == null) {
            return;
        }
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < d.fees().size(); i++) {
            var f = d.fees().get(i);
            String path = "fees[" + i + "]";
            if (f.code() == null || !seen.add(f.code())) {
                out.add(Issue.error(path + ".code", "Fee code is missing or duplicated"));
            }
            if (f.trigger() == null || !FEE_TRIGGERS.contains(f.trigger())) {
                out.add(Issue.error(path + ".trigger", "Unknown trigger " + f.trigger() + "; use one of " + FEE_TRIGGERS));
            }
            if (f.amount() == null) {
                out.add(Issue.error(path + ".amount", "Amount expression is required"));
            } else {
                try {
                    Cel.compile(f.amount(), FEE_VARIABLES);
                } catch (IllegalArgumentException e) {
                    out.add(Issue.error(path + ".amount", e.getMessage()));
                }
            }
        }
    }

    private static void waterfall(ProductDefinition d, boolean lending, List<Issue> out) {
        var w = d.repaymentWaterfall();
        if (w == null) {
            if (lending) {
                out.add(Issue.error("repayment_waterfall", "Lending products need a repayment waterfall"));
            }
            return;
        }
        Set<String> seen = new HashSet<>();
        for (String c : w) {
            if (!WATERFALL.contains(c)) {
                out.add(Issue.error("repayment_waterfall", "Unknown component " + c));
            }
            if (!seen.add(c)) {
                out.add(Issue.error("repayment_waterfall", "Duplicate component " + c));
            }
        }
        if (lending && !(seen.contains("PRINCIPAL_DUE") && seen.contains("INTEREST_DUE"))) {
            out.add(Issue.error("repayment_waterfall", "Must include INTEREST_DUE and PRINCIPAL_DUE"));
        }
    }

    private static void tax(ProductDefinition d, List<Issue> out) {
        if (d.tax() == null || d.tax().vat() == null) {
            return;
        }
        var v = d.tax().vat();
        if (v.rate() == null || v.rate().signum() < 0 || v.rate().compareTo(new BigDecimal("0.30")) > 0) {
            out.add(Issue.error("tax.vat.rate", "VAT rate must be between 0 and 0.30"));
        }
        if (v.appliesTo() == null || v.appliesTo().isEmpty()) {
            out.add(Issue.error("tax.vat.applies_to", "Say what VAT applies to"));
        }
    }

    private static void earlySettlement(ProductDefinition d, List<Issue> out) {
        var es = d.earlySettlement();
        if (es == null || es.rebate() == null) {
            return;
        }
        try {
            RebateRule.parse(es.rebate());
        } catch (IllegalArgumentException e) {
            out.add(Issue.error("early_settlement.rebate", e.getMessage()));
        }
    }

    private static void deposit(ProductDefinition d, List<Issue> out) {
        var dep = d.deposit();
        boolean tiered = d.pricing() != null && d.pricing().rateType() == RateType.TIERED;
        if (d.family() != Family.DEPOSIT) {
            if (dep != null) {
                out.add(Issue.error("deposit", "The deposit block is only for DEPOSIT products"));
            }
            if (tiered) {
                out.add(Issue.error("pricing.rate_type", "TIERED pricing is for DEPOSIT products"));
            }
            return;
        }
        if (tiered && (dep == null || dep.tiers() == null || dep.tiers().isEmpty())) {
            out.add(Issue.error("deposit.tiers", "TIERED pricing needs at least one tier"));
            return;
        }
        if (dep == null) {
            return;
        }
        if (dep.whtRate() != null && (dep.whtRate().signum() < 0 || dep.whtRate().compareTo(BigDecimal.ONE) >= 0)) {
            out.add(Issue.error("deposit.wht_rate", "Withholding rate must be between 0 and 1"));
        }
        if (dep.tiers() != null) {
            for (int i = 0; i < dep.tiers().size(); i++) {
                var t = dep.tiers().get(i);
                boolean last = i == dep.tiers().size() - 1;
                if (t.rate() == null || t.rate().signum() < 0 || t.rate().compareTo(BigDecimal.ONE) > 0) {
                    out.add(Issue.error("deposit.tiers[" + i + "].rate", "Tier rate must be between 0 and 1"));
                }
                if (last && t.upTo() != null) {
                    out.add(Issue.error("deposit.tiers[" + i + "].up_to", "The last tier must have no upper bound"));
                }
                if (!last && t.upTo() == null) {
                    out.add(Issue.error("deposit.tiers[" + i + "].up_to", "Only the last tier may be unbounded"));
                }
                if (!last && t.upTo() != null && i > 0 && dep.tiers().get(i - 1).upTo() != null
                        && t.upTo().compareTo(dep.tiers().get(i - 1).upTo()) <= 0) {
                    out.add(Issue.error("deposit.tiers[" + i + "].up_to", "Tier bounds must increase"));
                }
            }
        }
    }

    private static void delinquency(ProductDefinition d, boolean lending, List<Issue> out) {
        var q = d.delinquency();
        if (q == null) {
            if (lending) {
                out.add(Issue.warning("delinquency", "No delinquency rules: arrears will not be bucketed"));
            }
            return;
        }
        if (q.buckets() != null) {
            for (int i = 0; i < q.buckets().size(); i++) {
                if (q.buckets().get(i) < 1 || (i > 0 && q.buckets().get(i) <= q.buckets().get(i - 1))) {
                    out.add(Issue.error("delinquency.buckets", "Buckets must be positive and strictly increasing"));
                    break;
                }
            }
        }
        if (q.nonAccrualAtDpd() != null && q.writeOffAtDpd() != null && q.nonAccrualAtDpd() > q.writeOffAtDpd()) {
            out.add(Issue.error("delinquency.non_accrual_at_dpd", "Non-accrual must not come after write-off"));
        }
    }
}
