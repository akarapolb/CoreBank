package org.fabor.simulator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.fabor.engine.product.ProductDefinition;
import org.fabor.engine.product.ProductLoader;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.time.BusinessCalendar;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class SimulatorTest {
    static final BusinessCalendar CAL = BusinessCalendar.monToFri(Set.of());
    static final LocalDate D0 = LocalDate.of(2026, 1, 15);
    static final Money P = Money.of(new BigDecimal("100000"), Currency.THB);

    static ProductDefinition product() throws IOException {
        try (var in = SimulatorTest.class.getResourceAsStream("/personal-loan.yaml")) {
            return ProductLoader.parse(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    @Test
    void standardScenariosOnAKnownProduct() throws IOException {
        List<ScenarioResult> r = ProductSimulator.run(product(), P, 12, D0, CAL, ProductSimulator.standardScenarios(12));
        assertThat(r).extracting(ScenarioResult::scenario).containsExactly("on_time", "missed_1_by_10d",
                "missed_2_by_45d", "early_settlement_at_6");
        ScenarioResult onTime = r.get(0);
        assertThat(onTime.upfrontFees()).isEqualTo(100_000);
        assertThat(onTime.totalPaidByCustomer()).isEqualTo(onTime.interest() + 10_000_000 + onTime.upfrontFees());
        assertThat(onTime.finalBalance()).isZero();
        // late charge: 0.04% a day on the overdue instalment
        assertThat(r.get(1).lateCharges()).isEqualTo(10 * Math.round(916_800 * 0.0004));
        assertThat(r.get(2).lateCharges()).isGreaterThan(r.get(1).lateCharges());
        // paying late costs the customer more than paying on time
        assertThat(r.get(1).totalPaidByCustomer()).isGreaterThan(onTime.totalPaidByCustomer());
        assertThat(r.get(1).effectiveRate()).isGreaterThan(onTime.effectiveRate());
        // settling early means less interest paid
        assertThat(r.get(3).interest()).isLessThan(onTime.interest());
        assertThat(r.get(3).instalments()).isEqualTo(6);
    }

    @Test
    void earlySettlementFeeComesFromTheProduct() throws IOException {
        String y = new String(getClass().getResourceAsStream("/personal-loan.yaml").readAllBytes(), StandardCharsets.UTF_8)
                .replace("    amount: \"rate(overdue, 0.0004)\"", "    amount: \"rate(overdue, 0.0004)\"\n  - code: SETTLEMENT_FEE\n"
                        + "    trigger: EARLY_SETTLEMENT\n    amount: \"rate(outstanding, 0.02)\"");
        ScenarioResult r = ProductSimulator.run(ProductLoader.parse(y), P, 12, D0, CAL, List.of(Scenario.earlySettlement(6))).get(0);
        assertThat(r.settlementFee()).isPositive();
    }

    @Test
    void productWithoutFeesHasNoCharges() throws IOException {
        String y = new String(getClass().getResourceAsStream("/personal-loan.yaml").readAllBytes(), StandardCharsets.UTF_8)
                .replaceAll("(?s)fees:.*?repayment_waterfall:", "repayment_waterfall:");
        List<ScenarioResult> r = ProductSimulator.run(ProductLoader.parse(y), P, 12, D0, CAL,
                List.of(Scenario.missed(1, 5), Scenario.earlySettlement(3)));
        assertThat(r.get(0).lateCharges()).isZero();
        assertThat(r.get(1).settlementFee()).isZero();
    }

    @Test
    void scenarioIndexIsChecked() throws IOException {
        assertThatThrownBy(() -> ProductSimulator.run(product(), P, 12, D0, CAL, List.of(Scenario.missed(13, 1))))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ProductSimulator.run(product(), P, 12, D0, CAL, List.of(Scenario.earlySettlement(0))))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(ProductSimulator.days(D0, D0.plusDays(3))).isEqualTo(3);
    }

    @Test
    void goldenRecordVerifyAndDetectChange(@TempDir Path dir) throws IOException {
        Path file = dir.resolve("PERSONAL_LOAN_STD/tests/v1.golden.json");
        List<ScenarioResult> base = ProductSimulator.run(product(), P, 12, D0, CAL, ProductSimulator.standardScenarios(12));
        Golden.record(file, base);
        assertThat(Golden.verify(file, base)).isEmpty();
        // a rate change must be caught
        String y = new String(getClass().getResourceAsStream("/personal-loan.yaml").readAllBytes(), StandardCharsets.UTF_8)
                .replace("rate: 0.18", "rate: 0.19");
        List<ScenarioResult> changed = ProductSimulator.run(ProductLoader.parse(y), P, 12, D0, CAL,
                ProductSimulator.standardScenarios(12));
        assertThat(Golden.verify(file, changed)).isPresent().get().asString().contains("golden has");
        // fewer scenarios: length difference reported too
        assertThat(Golden.verify(file, base.subList(0, 2))).isPresent();
        Files.writeString(file, Golden.render(base) + "extra\n");
        assertThat(Golden.verify(file, base)).isPresent();
    }

    @Test
    void committedGoldenFileStillMatches() throws IOException {
        Path file = Path.of("src/test/resources/golden/PERSONAL_LOAN_STD.v1.golden.json");
        List<ScenarioResult> now = ProductSimulator.run(product(), P, 12, D0, CAL, ProductSimulator.standardScenarios(12));
        if (!Files.exists(file)) {
            Golden.record(file, now); // first run creates it; commit the file
        }
        assertThat(Golden.verify(file, now)).as("golden drift").isEmpty();
    }
}
