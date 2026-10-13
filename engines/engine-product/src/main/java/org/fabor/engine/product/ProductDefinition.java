package org.fabor.engine.product;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * A product version as loaded from YAML. Every field name is the YAML key in snake_case. Unknown keys are
 * rejected when loading, so a typo cannot silently drop a rule.
 */
public record ProductDefinition(
        String product,
        Integer version,
        Family family,
        String currency,
        List<String> segment,
        Map<String, Param> parameters,
        Pricing pricing,
        Schedule schedule,
        List<Fee> fees,
        List<String> repaymentWaterfall,
        Tax tax,
        EarlySettlement earlySettlement,
        Delinquency delinquency,
        Accounting accounting,
        Deposit deposit) {

    public enum Family { DEPOSIT, LOAN, CREDIT_LINE, LEASE, ASSET_FINANCE }

    public enum RateType { FLAT, FIXED, FLOATING, STEPPED, TIERED, CUSTOM }

    public record Param(BigDecimal min, BigDecimal max, List<BigDecimal> allowed,
                        @com.fasterxml.jackson.annotation.JsonProperty("default") BigDecimal defaultValue) { }

    public record Pricing(RateType rateType, BigDecimal rate, String rateTable, String disclosedRate, String dayCount) { }

    public record FirstDue(String rule) { }

    public record Schedule(String method, String frequency, FirstDue firstDue, String holidayRule) { }

    /** {@code amount} is a CEL expression yielding minor units; variables: principal, term, overdue, outstanding. */
    public record Fee(String code, String trigger, String amount, String cap) { }

    public record Vat(List<String> appliesTo, BigDecimal rate, String point) { }

    public record Tax(Vat vat) { }

    public record EarlySettlement(Boolean allowed, String rebate, String fee) { }

    public record Delinquency(List<Integer> buckets, Integer nonAccrualAtDpd, Integer writeOffAtDpd) { }

    public record Accounting(String glMapping) { }

    /** Tier bound {@code upTo} is in major units; the last tier has no bound. */
    public record Tier(BigDecimal upTo, BigDecimal rate) { }

    public enum TierMode { WHOLE_BALANCE, MARGINAL }

    /** Savings and current account behaviour. WHT is withholding tax on interest, charged to the customer. */
    public record Deposit(String interestPosting, TierMode tierMode, List<Tier> tiers, BigDecimal whtRate,
                          BigDecimal whtExemptAnnual, BigDecimal minBalance) { }
}
