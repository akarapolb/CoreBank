package org.fabor.engine.product;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class HirePurchaseRulesTest {
    static final String CAR = """
            product: CAR_HP_NEW
            version: 1
            family: ASSET_FINANCE
            currency: THB
            segment: [RETAIL, NEW_CAR]
            parameters:
              principal:   { min: 100000, max: 3000000, default: 500000 }
              term_months: { allowed: [12, 24, 36, 48, 60, 72] }
            pricing:
              rate_type: FIXED
              rate: 0.09
            schedule:
              method: ANNUITY
              frequency: MONTHLY
              holiday_rule: FOLLOWING
            repayment_waterfall: [FEES_DUE, PENALTY_DUE, VAT_DUE, INTEREST_DUE, PRINCIPAL_DUE]
            early_settlement:
              allowed: true
              rebate: "TIERED:0.6,0.7,1"
            delinquency:
              buckets: [1, 30, 60, 90]
              non_accrual_at_dpd: 90
            accounting:
              gl_mapping: hp_th_v1
            """;

    static ProductDefinition product(String yaml) {
        return ProductLoader.parse(yaml);
    }

    static List<Issue> check(String yaml) {
        return new ThailandHirePurchaseRules().check(product(yaml));
    }

    static List<String> errorPaths(List<Issue> issues) {
        return issues.stream().filter(i -> i.severity() == Issue.Severity.ERROR).map(Issue::path).toList();
    }

    @Test
    void aCompliantNewCarProductPasses() {
        assertThat(ProductValidator.ok(ProductValidator.validate(product(CAR)))).isTrue();
        assertThat(check(CAR)).isEmpty();
        assertThat(new ThailandHirePurchaseRules().id()).isEqualTo("TH-HP-VEHICLE-v1");
    }

    @Test
    void rateAboveTheClassCeilingIsRejected() {
        assertThat(errorPaths(check(CAR.replace("rate: 0.09", "rate: 0.11")))).containsExactly("pricing.rate");
        // the same rate is fine for a used car (15%) and a motorcycle (23%)
        String used = CAR.replace("NEW_CAR", "USED_CAR").replace("rate: 0.09", "rate: 0.11");
        assertThat(check(used)).isEmpty();
        String bike = CAR.replace("NEW_CAR", "MOTORCYCLE").replace("rate: 0.09", "rate: 0.20");
        assertThat(check(bike)).isEmpty();
        assertThat(errorPaths(check(bike.replace("0.20", "0.24")))).containsExactly("pricing.rate");
    }

    @Test
    void theStrictestCeilingAppliesWhenSegmentsOverlap() {
        String both = CAR.replace("[RETAIL, NEW_CAR]", "[NEW_CAR, USED_CAR]").replace("rate: 0.09", "rate: 0.12");
        assertThat(errorPaths(check(both))).containsExactly("pricing.rate");
    }

    @Test
    void monthlyCompoundingAboveTheCeilingIsOnlyAWarning() {
        // 9.6% a year on the balance is under the 10% ceiling, but compounds to about 10.03%
        List<Issue> issues = check(CAR.replace("rate: 0.09", "rate: 0.096"));
        assertThat(errorPaths(issues)).isEmpty();
        assertThat(issues).singleElement().satisfies(i -> {
            assertThat(i.severity()).isEqualTo(Issue.Severity.WARNING);
            assertThat(i.path()).isEqualTo("pricing.rate");
        });
        // quarterly schedules are not compounded monthly: no warning
        assertThat(check(CAR.replace("rate: 0.09", "rate: 0.096").replace("frequency: MONTHLY", "frequency: QUARTERLY")))
                .isEmpty();
    }

    @Test
    void flatRatePricingIsNotAllowedForVehicles() {
        String flat = CAR.replace("rate_type: FIXED", "rate_type: FLAT").replace("method: ANNUITY", "method: ANNUITY_FROM_FLAT");
        assertThat(errorPaths(check(flat))).contains("pricing.rate_type");
    }

    @Test
    void rebateMustBeStatedAndMeetTheMinimum() {
        assertThat(errorPaths(check(CAR.replace("rebate: \"TIERED:0.6,0.7,1\"", "rebate: NONE"))))
                .containsExactly("early_settlement.rebate");
        assertThat(errorPaths(check(CAR.replace("  rebate: \"TIERED:0.6,0.7,1\"\n", "")))).containsExactly("early_settlement.rebate");
        assertThat(errorPaths(check(CAR.replace("early_settlement:\n  allowed: true\n  rebate: \"TIERED:0.6,0.7,1\"\n", ""))))
                .containsExactly("early_settlement.rebate");
        assertThat(errorPaths(check(CAR.replace("TIERED:0.6,0.7,1", "RULE_OF_78")))).containsExactly("early_settlement.rebate");
        assertThat(errorPaths(check(CAR.replace("TIERED:0.6,0.7,1", "PERCENT:0.5")))).containsExactly("early_settlement.rebate");
        // each tier is checked on its own
        assertThat(errorPaths(check(CAR.replace("TIERED:0.6,0.7,1", "TIERED:0.6,0.6,1")))).containsExactly("early_settlement.rebate");
        assertThat(errorPaths(check(CAR.replace("TIERED:0.6,0.7,1", "TIERED:0.6,0.7,0.9")))).containsExactly("early_settlement.rebate");
        assertThat(errorPaths(check(CAR.replace("TIERED:0.6,0.7,1", "NOT_A_RULE")))).containsExactly("early_settlement.rebate");
        assertThat(check(CAR.replace("TIERED:0.6,0.7,1", "ACTUARIAL"))).isEmpty();
        assertThat(check(CAR.replace("TIERED:0.6,0.7,1", "PERCENT:1"))).isEmpty();
    }

    @Test
    void productsOutsideTheVehicleSegmentsAreNotChecked() {
        assertThat(check(CAR.replace("[RETAIL, NEW_CAR]", "[RETAIL]").replace("rate: 0.09", "rate: 0.30"))).isEmpty();
        assertThat(check(CAR.replace("[RETAIL, NEW_CAR]", "[RETAIL]").replace("rebate: \"TIERED:0.6,0.7,1\"", "rebate: NONE")))
                .isEmpty();
        assertThat(check(CAR.replace("segment: [RETAIL, NEW_CAR]\n", ""))).isEmpty();
        assertThat(check(CAR.replace("currency: THB", "currency: USD"))).isEmpty();
    }

    @Test
    void ceilingsAndMinimumsAreConfiguration() {
        var strict = new ThailandHirePurchaseRules(Map.of("NEW_CAR", new BigDecimal("0.05")),
                List.of(BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ONE));
        assertThat(errorPaths(strict.check(product(CAR)))).containsExactlyInAnyOrder("pricing.rate", "early_settlement.rebate");
        assertThatThrownBy(() -> new ThailandHirePurchaseRules(Map.of(), List.of(BigDecimal.ONE)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void validatorRejectsAnUnknownRebateRuleOnAnyProduct() {
        ProductDefinition d = product(CAR.replace("TIERED:0.6,0.7,1", "SOMETHING_ELSE"));
        assertThat(ProductValidator.validate(d)).anyMatch(i -> i.path().equals("early_settlement.rebate")
                && i.severity() == Issue.Severity.ERROR);
        // legacy names stay valid
        for (String legacy : new String[] {"NONE", "EIR"}) {
            assertThat(ProductValidator.ok(ProductValidator.validate(product(CAR.replace("TIERED:0.6,0.7,1", legacy))))).isTrue();
        }
    }
}
