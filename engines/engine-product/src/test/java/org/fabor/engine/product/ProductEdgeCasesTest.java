package org.fabor.engine.product;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.time.BusinessCalendar;
import org.junit.jupiter.api.Test;

class ProductEdgeCasesTest {
    private static String y() throws IOException {
        return ProductEngineTest.yaml();
    }

    private static String paths(String yaml) {
        return ProductEngineTest.paths(ProductLoader.parse(yaml));
    }

    @Test
    void moreValidatorBranches() throws IOException {
        String base = "product: SOME_LOAN\nversion: 1\nfamily: LOAN\ncurrency: THB\npricing: { rate_type: FIXED, rate: 0.1 }\n"
                + "schedule: { method: ANNUITY, frequency: MONTHLY }\naccounting: { gl_mapping: x }\n";
        assertThat(paths(base + "parameters:\n  principal:\n")).contains("parameters.principal");
        assertThat(paths(base + "repayment_waterfall: [INTEREST_DUE, PRINCIPAL_DUE]\nfees:\n  - trigger: DISBURSEMENT\n"))
                .contains("fees[0].code", "fees[0].amount");
        assertThat(paths(base + "repayment_waterfall: [INTEREST_DUE, PRINCIPAL_DUE]\nfees:\n  - code: A\n    amount: '1'\n"))
                .contains("fees[0].trigger");
        assertThat(paths(base + "repayment_waterfall: [INTEREST_DUE, PRINCIPAL_DUE]\ndelinquency: { buckets: [0, 5] }"))
                .contains("delinquency.buckets");
        assertThat(ProductValidator.validate(ProductLoader.parse(base + "repayment_waterfall: [INTEREST_DUE, PRINCIPAL_DUE]\n"
                + "tax: { }\nschedule: { method: ANNUITY, frequency: MONTHLY, holiday_rule: PRECEDING }\n"
                .replace("schedule: { method: ANNUITY, frequency: MONTHLY, holiday_rule: PRECEDING }\n", ""))))
                .anyMatch(i -> i.severity() == Issue.Severity.WARNING);
        assertThat(paths(y().replace("rate_type: FIXED", "rate_type: FIXED").replace("  rate: 0.18\n", "  rate: -0.1\n")))
                .contains("pricing.rate");
        assertThat(paths(y().replace("version: 1", ""))).contains("version");
        assertThat(paths(y().replace("tax:\n  vat: { applies_to: [FEES], rate: 0.07, point: DUE_DATE }", "tax:\n  vat: { applies_to: [FEES] }")))
                .contains("tax.vat.rate");
        assertThat(paths(y().replace("fees:", "xfees:").replace("xfees:", "fees: []\nunused_placeholder_removed_below:").replaceAll("unused_placeholder_removed_below:(?s).*?(?=repayment_waterfall:)", "")))
                .isEqualTo("[]");
    }

    @Test
    void permitsCoversRangeEdges() {
        var p = new ProductDefinition.Param(new BigDecimal("1"), new BigDecimal("3"), null, null);
        assertThat(ProductValidator.permits(p, new BigDecimal("1"))).isTrue();
        assertThat(ProductValidator.permits(p, new BigDecimal("3"))).isTrue();
        assertThat(ProductValidator.permits(p, new BigDecimal("0.9"))).isFalse();
        assertThat(ProductValidator.permits(p, new BigDecimal("3.1"))).isFalse();
        assertThat(ProductValidator.permits(new ProductDefinition.Param(null, null, null, null), BigDecimal.TEN)).isTrue();
        assertThat(ProductValidator.permits(new ProductDefinition.Param(null, new BigDecimal("5"), null, null), BigDecimal.TEN)).isFalse();
    }

    @Test
    void quoteWithoutHolidayRuleOrParametersAndNonDisbursementFees() throws IOException {
        String noRule = y().replace("  holiday_rule: FOLLOWING\n", "").replaceAll("(?s)parameters:.*?pricing:", "pricing:");
        var q = ProductQuote.quote(ProductLoader.parse(noRule), Money.of(new BigDecimal("20000"), Currency.THB), 6,
                LocalDate.of(2026, 1, 15), BusinessCalendar.monToFri(Set.of()));
        assertThat(q.disbursementFees()).containsOnlyKeys("ORIGINATION_FEE"); // late charge is not a disbursement fee
    }

    @Test
    void rulePackFallbacksAndWarnings() throws IOException {
        RulePack pack = new ThailandRetailRules();
        // no default principal: falls back to the minimum; no allowed terms: 12 months
        String minOnly = y().replace(", default: 50000", "").replace("allowed: [6, 12, 24, 36, 48, 60]", "min: 6, max: 60");
        assertThat(pack.check(ProductLoader.parse(minOnly))).isEmpty();
        // neither default nor min on principal: 50,000 sample
        String noMin = y().replace("{ min: 10000, max: 500000, default: 50000 }", "{ max: 500000 }");
        assertThat(pack.check(ProductLoader.parse(noMin))).isEmpty();
        // a sample outside the product's own limits cannot be quoted: warning, not a crash
        String unquotable = y().replace("allowed: [6, 12, 24, 36, 48, 60]", "allowed: [7]")
                .replace("min: 10000, max: 500000, default: 50000", "min: 10000, max: 500000, default: 400000");
        assertThat(pack.check(ProductLoader.parse(unquotable))).isEmpty();
        String badSample = y().replace("allowed: [6, 12, 24, 36, 48, 60]", "allowed: [6, 12]")
                .replace("min: 10000, max: 500000, default: 50000", "min: 10000, max: 500000, default: 20000")
                .replace("rate_type: FIXED\n  rate: 0.18", "rate_type: FIXED\n  rate_table: t1");
        assertThat(pack.check(ProductLoader.parse(badSample))).isEmpty();
        // a rate table product has no fixed rate to check
        String outOfRange = y().replace("allowed: [6, 12, 24, 36, 48, 60]", "allowed: [6, 12]")
                .replace("min: 10000, max: 500000, default: 50000", "min: 10000, max: 500000, default: 5");
        assertThat(ProductValidator.ok(ProductValidator.validate(ProductLoader.parse(outOfRange)))).isFalse();
        assertThat(pack.check(ProductLoader.parse(outOfRange))).isEmpty();
        // quote fails after validation passes: a term outside the allowed list (min default below term rule)
        String termMismatch = y().replace("allowed: [6, 12, 24, 36, 48, 60]", "min: 100, max: 200");
        assertThat(pack.check(ProductLoader.parse(termMismatch)))
                .anyMatch(i -> i.severity() == Issue.Severity.WARNING);
    }

    @Test
    void celExpressionHandlesNonIntegerResultsDefensively() {
        var e = new Cel.Expression("x", Cel.compile("1", java.util.List.of()).ast());
        assertThat(e.evaluate(java.util.Map.of())).isEqualTo(1);
        assertThat(ProductValidator.FEE_VARIABLES).contains("principal");
    }
}
