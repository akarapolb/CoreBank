package org.fabor.engine.product;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.time.BusinessCalendar;
import org.junit.jupiter.api.Test;

class ProductEngineTest {
    static String yaml() throws IOException {
        try (var in = ProductEngineTest.class.getResourceAsStream("/products/personal-loan.yaml")) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    static ProductDefinition load() throws IOException {
        return ProductLoader.parse(yaml());
    }

    static List<Issue> errors(ProductDefinition d) {
        return ProductValidator.validate(d).stream().filter(i -> i.severity() == Issue.Severity.ERROR).toList();
    }

    static String paths(ProductDefinition d) {
        return errors(d).stream().map(Issue::path).toList().toString();
    }

    @Test
    void sampleProductLoadsAndIsValid() throws IOException {
        ProductDefinition d = load();
        assertThat(d.product()).isEqualTo("PERSONAL_LOAN_STD");
        assertThat(d.parameters().get("principal").defaultValue()).isEqualByComparingTo("50000");
        assertThat(errors(d)).isEmpty();
        assertThat(ProductValidator.ok(ProductValidator.validate(d))).isTrue();
    }

    @Test
    void unknownKeysAndBadYamlAreRejected() throws IOException {
        assertThatThrownBy(() -> ProductLoader.parse(yaml().replace("pricing:", "prcing:")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("prcing");
        assertThatThrownBy(() -> ProductLoader.parse("product: [unclosed")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void validatorFindsStructuralErrors() throws IOException {
        String y = yaml();
        assertThat(paths(ProductLoader.parse(y.replace("PERSONAL_LOAN_STD", "bad code")))).contains("product");
        assertThat(paths(ProductLoader.parse(y.replace("version: 1", "version: 0")))).contains("version");
        assertThat(paths(ProductLoader.parse(y.replace("currency: THB", "currency: ZZZ")))).contains("currency");
        assertThat(paths(ProductLoader.parse(y.replace("rate: 0.18", "rate: 18")))).contains("pricing.rate");
        assertThat(paths(ProductLoader.parse(y.replace("method: ANNUITY", "method: MAGIC")))).contains("schedule.method");
        assertThat(paths(ProductLoader.parse(y.replace("frequency: MONTHLY", "frequency: SOMETIMES")))).contains("schedule.frequency");
        assertThat(paths(ProductLoader.parse(y.replace("holiday_rule: FOLLOWING", "holiday_rule: WHENEVER")))).contains("schedule.holiday_rule");
        assertThat(paths(ProductLoader.parse(y.replace("day_count: ACT_365F", "day_count: ACT_999")))).contains("pricing.day_count");
        assertThat(paths(ProductLoader.parse(y.replace("min: 10000, max: 500000, default: 50000", "min: 9, max: 5")))).contains("parameters.principal");
        assertThat(paths(ProductLoader.parse(y.replace("default: 50000", "default: 5")))).contains("parameters.principal.default");
        assertThat(paths(ProductLoader.parse(y.replace("{ min: 10000, max: 500000, default: 50000 }", "{ min: 1, allowed: [1] }")))).contains("parameters.principal");
        assertThat(paths(ProductLoader.parse(y.replace("allowed: [6, 12, 24, 36, 48, 60]", "allowed: []")))).contains("parameters.term_months");
        assertThat(paths(ProductLoader.parse(y.replace("gl_mapping: personal_loan_th_v1", "gl_mapping: ' '")))).contains("accounting.gl_mapping");
    }

    @Test
    void validatorChecksFeesWaterfallTaxAndDelinquency() throws IOException {
        String y = yaml();
        assertThat(paths(ProductLoader.parse(y.replace("trigger: DISBURSEMENT", "trigger: WHENEVER")))).contains("fees[0].trigger");
        assertThat(paths(ProductLoader.parse(y.replace("code: LATE_CHARGE", "code: ORIGINATION_FEE")))).contains("fees[1].code");
        assertThat(paths(ProductLoader.parse(y.replace("rate(overdue, 0.0004)", "overdue * 0.0004")))).contains("fees[1].amount");
        assertThat(paths(ProductLoader.parse(y.replace("rate(overdue, 0.0004)", "nonsense(1)")))).contains("fees[1].amount");
        assertThat(paths(ProductLoader.parse(y.replace("[FEES_DUE, PENALTY_DUE, VAT_DUE, INTEREST_DUE, PRINCIPAL_DUE]", "[FEES_DUE, FEES_DUE, MAGIC]")))).contains("repayment_waterfall");
        assertThat(paths(ProductLoader.parse(y.replace("[FEES_DUE, PENALTY_DUE, VAT_DUE, INTEREST_DUE, PRINCIPAL_DUE]", "[FEES_DUE]")))).contains("repayment_waterfall");
        assertThat(paths(ProductLoader.parse(y.replace("rate: 0.07", "rate: 0.9")))).contains("tax.vat.rate");
        assertThat(paths(ProductLoader.parse(y.replace("applies_to: [FEES]", "applies_to: []")))).contains("tax.vat.applies_to");
        assertThat(paths(ProductLoader.parse(y.replace("buckets: [1, 30, 60, 90]", "buckets: [30, 30]")))).contains("delinquency.buckets");
        assertThat(paths(ProductLoader.parse(y.replace("non_accrual_at_dpd: 90", "non_accrual_at_dpd: 400")))).contains("delinquency.non_accrual_at_dpd");
    }

    @Test
    void flatPricingNeedsFlatMethodAndViceVersa() throws IOException {
        String y = yaml();
        assertThat(paths(ProductLoader.parse(y.replace("method: ANNUITY", "method: ANNUITY_FROM_FLAT")))).contains("schedule.method");
        assertThat(paths(ProductLoader.parse(y.replace("rate_type: FIXED", "rate_type: FLAT")))).contains("pricing.rate_type");
        assertThat(paths(ProductLoader.parse(y.replace("  rate: 0.18\n", "")))).contains("pricing.rate");
    }

    @Test
    void missingBlocksAreReported() {
        ProductDefinition d = ProductLoader.parse("product: ONLY_CODE");
        assertThat(paths(d)).contains("version", "family", "currency", "pricing", "accounting.gl_mapping");
        ProductDefinition loan = ProductLoader.parse("product: SOME_LOAN\nversion: 1\nfamily: LOAN\ncurrency: THB\n"
                + "pricing: { rate_type: FIXED, rate: 0.1 }\naccounting: { gl_mapping: x }");
        assertThat(paths(loan)).contains("schedule", "repayment_waterfall");
        assertThat(ProductValidator.validate(loan)).anyMatch(i -> i.severity() == Issue.Severity.WARNING);
        ProductDefinition noRateType = ProductLoader.parse("product: SOME_LOAN\nversion: 1\nfamily: LOAN\ncurrency: THB\n"
                + "pricing: { rate: 0.1 }\naccounting: { gl_mapping: x }");
        assertThat(paths(noRateType)).contains("pricing.rate_type");
        ProductDefinition deposit = ProductLoader.parse("product: SAVINGS_BASIC\nversion: 1\nfamily: DEPOSIT\ncurrency: THB\n"
                + "pricing: { rate_type: FIXED, rate: 0.01 }\naccounting: { gl_mapping: dep }");
        assertThat(errors(deposit)).isEmpty();
    }

    @Test
    void celFeeMathIsExactAndBounded() {
        var fee = Cel.compile("min(max(rate(principal, 0.01), 20000), 200000)", ProductValidator.FEE_VARIABLES);
        assertThat(fee.evaluate(Map.of("principal", 5_000_000L))).isEqualTo(50_000);      // 1% of 50,000.00
        assertThat(fee.evaluate(Map.of("principal", 100_000L))).isEqualTo(20_000);        // floor
        assertThat(fee.evaluate(Map.of("principal", 90_000_000L))).isEqualTo(200_000);    // cap
        assertThat(Cel.compile("rate(principal, 0.005)", List.of("principal")).evaluate(Map.of("principal", 1_001L)))
                .isEqualTo(5); // 5.005 rounds half-up
        assertThatThrownBy(() -> Cel.compile("principal + 1.5", List.of("principal"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Cel.compile("unknown_var", List.of("principal"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Cel.compile("principal / overdue", List.of("principal", "overdue"))
                .evaluate(Map.of("principal", 1L, "overdue", 0L))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void quoteGolden() throws IOException {
        ProductDefinition d = load();
        var q = ProductQuote.quote(d, Money.of(new BigDecimal("100000"), Currency.THB), 12, LocalDate.of(2026, 1, 15),
                BusinessCalendar.monToFri(Set.of()));
        assertThat(q.schedule().installments()).hasSize(12);
        assertThat(q.schedule().installments().get(0).total().minor()).isEqualTo(916_800); // 9,168.00 at 18%/12 months
        assertThat(q.disbursementFees().get("ORIGINATION_FEE").minor()).isEqualTo(100_000); // 1,000.00
        assertThat(q.disclosedEffectiveRate().doubleValue()).isBetween(0.195, 0.197);
    }

    @Test
    void quoteEnforcesParametersAndCurrency() throws IOException {
        ProductDefinition d = load();
        BusinessCalendar cal = BusinessCalendar.monToFri(Set.of());
        LocalDate day = LocalDate.of(2026, 1, 15);
        assertThatThrownBy(() -> ProductQuote.quote(d, Money.of(new BigDecimal("5"), Currency.THB), 12, day, cal))
                .hasMessageContaining("principal");
        assertThatThrownBy(() -> ProductQuote.quote(d, Money.of(new BigDecimal("50000"), Currency.THB), 13, day, cal))
                .hasMessageContaining("term_months");
        assertThatThrownBy(() -> ProductQuote.quote(d, Money.of(new BigDecimal("50000"), Currency.USD), 12, day, cal))
                .hasMessageContaining("currency");
        assertThatThrownBy(() -> ProductQuote.quote(ProductLoader.parse("product: X"), Money.zero(Currency.THB), 1, day, cal))
                .hasMessageContaining("not valid");
        ProductDefinition table = ProductLoader.parse(yaml().replace("  rate: 0.18\n", "  rate_table: personal_2026\n"));
        assertThatThrownBy(() -> ProductQuote.quote(table, Money.of(new BigDecimal("50000"), Currency.THB), 12, day, cal))
                .hasMessageContaining("Rate tables");
    }

    @Test
    void thailandRulePack() throws IOException {
        RulePack pack = new ThailandRetailRules();
        assertThat(pack.id()).isEqualTo("TH-RETAIL-v1");
        assertThat(pack.check(load())).isEmpty();
        // 26% nominal breaches the ceiling directly
        assertThat(pack.check(ProductLoader.parse(yaml().replace("rate: 0.18", "rate: 0.26"))))
                .anyMatch(i -> i.path().equals("pricing.rate") && i.severity() == Issue.Severity.ERROR);
        // 23% nominal is under the nominal ceiling but its effective rate (about 25.6%) is over it
        assertThat(pack.check(ProductLoader.parse(yaml().replace("rate: 0.18", "rate: 0.23"))))
                .anyMatch(i -> i.message().contains("All-in effective rate"));
        // not applicable to other currencies or families
        assertThat(pack.check(ProductLoader.parse(yaml().replace("currency: THB", "currency: USD")))).isEmpty();
        assertThat(pack.check(ProductLoader.parse(yaml().replace("family: LOAN", "family: DEPOSIT")))).isEmpty();
        // an invalid product cannot be quoted: the pack stays quiet and the validator reports instead
        assertThat(pack.check(ProductLoader.parse(yaml().replace("method: ANNUITY", "method: MAGIC")))).isEmpty();
        // product with no parameters falls back to a default sample
        ProductDefinition noParams = ProductLoader.parse(yaml().replaceAll("(?s)parameters:.*?pricing:", "pricing:"));
        assertThat(pack.check(noParams)).isEmpty();
    }
}
