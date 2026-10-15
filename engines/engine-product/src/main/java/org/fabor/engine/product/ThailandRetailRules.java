package org.fabor.engine.product;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.time.BusinessCalendar;

/**
 * Thai retail lending rules, v1 subset: the personal-loan interest ceiling (25% a year all-in, applied here
 * to the effective rate of a sample quote at the product's own default or smallest permitted principal and
 * term). Vehicle hire purchase is covered by {@link ThailandHirePurchaseRules}.
 * <p>Rule values are configuration of the pack, not law: confirm against current Bank of Thailand notices
 * before production use.
 */
public final class ThailandRetailRules implements RulePack {
    public static final BigDecimal PERSONAL_LOAN_CAP = new BigDecimal("0.25");

    @Override
    public String id() {
        return "TH-RETAIL-v1";
    }

    @Override
    public List<Issue> check(ProductDefinition d) {
        List<Issue> out = new ArrayList<>();
        if (d.family() != ProductDefinition.Family.LOAN || d.pricing() == null || d.pricing().rate() == null
                || !"THB".equals(d.currency())) {
            return out;
        }
        if (d.pricing().rate().compareTo(PERSONAL_LOAN_CAP) > 0) {
            out.add(Issue.error("pricing.rate", "Personal loan rate " + d.pricing().rate() + " exceeds the "
                    + PERSONAL_LOAN_CAP + " ceiling"));
        }
        if (ProductValidator.ok(ProductValidator.validate(d))) {
            // fees count towards the all-in cost: check the effective rate of a representative quote
            try {
                var principalParam = d.parameters() == null ? null : d.parameters().get("principal");
                BigDecimal p = principalParam == null ? new BigDecimal("50000")
                        : principalParam.defaultValue() != null ? principalParam.defaultValue()
                        : principalParam.min() != null ? principalParam.min() : new BigDecimal("50000");
                var termParam = d.parameters() == null ? null : d.parameters().get("term_months");
                int term = termParam == null || termParam.allowed() == null ? 12 : termParam.allowed().get(0).intValue();
                var quote = ProductQuote.quote(d, Money.of(p, Currency.THB), term, LocalDate.of(2026, 1, 15),
                        BusinessCalendar.monToFri(java.util.Set.of()));
                Money fees = quote.disbursementFees().values().stream().reduce(Money.zero(Currency.THB), Money::plus);
                // all-in cost: fees reduce what the customer actually receives
                List<Long> pays = quote.schedule().installments().stream().map(i -> i.total().minor()).toList();
                BigDecimal allIn = org.fabor.engine.interest.Rates.effectiveAnnual(
                        org.fabor.engine.interest.Eir.periodicRate(
                                Money.of(p, Currency.THB).minus(fees).minor(), pays),
                        quote.schedule().installments().size() > 0 ? 12 : 1);
                if (allIn.compareTo(PERSONAL_LOAN_CAP) > 0) {
                    out.add(Issue.error("pricing.rate", "All-in effective rate " + allIn
                            .setScale(4, java.math.RoundingMode.HALF_UP) + " (including fees) exceeds the "
                            + PERSONAL_LOAN_CAP + " ceiling"));
                }
            } catch (IllegalArgumentException | ArithmeticException e) {
                out.add(Issue.warning("pricing", "Could not run the sample quote for the rate cap check: " + e.getMessage()));
            }
        }
        return out;
    }
}
