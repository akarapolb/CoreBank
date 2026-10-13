package org.fabor.engine.product;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class DepositValidationTest {
    private static String yaml() throws IOException {
        try (var in = DepositValidationTest.class.getResourceAsStream("/products/savings.yaml")) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static java.util.List<Issue> v(String y) {
        return ProductValidator.validate(ProductLoader.parse(y));
    }

    @Test
    void validDepositProduct() throws IOException {
        assertThat(ProductValidator.ok(v(yaml()))).isTrue();
        assertThat(ProductLoader.parse(yaml()).deposit().tiers()).hasSize(3);
    }

    @Test
    void tierRules() throws IOException {
        String y = yaml();
        assertThat(v(y.replace("{ rate: 0.0200 }", "{ up_to: 2000000, rate: 0.0200 }"))).anyMatch(i -> i.message().contains("last tier"));
        assertThat(v(y.replace("{ up_to: 1000000, rate: 0.0150 }", "{ rate: 0.0150 }"))).anyMatch(i -> i.message().contains("Only the last"));
        assertThat(v(y.replace("up_to: 1000000", "up_to: 50000"))).anyMatch(i -> i.message().contains("increase"));
        assertThat(v(y.replace("rate: 0.0100", "rate: 5"))).anyMatch(i -> i.path().contains("rate"));
        assertThat(v(y.replace("wht_rate: 0.15", "wht_rate: 1"))).anyMatch(i -> i.path().equals("deposit.wht_rate"));
        assertThat(v(y.replaceAll("(?s)deposit:.*?accounting:", "accounting:"))).anyMatch(i -> i.path().equals("deposit.tiers"));
        // a deposit block without TIERED pricing is allowed (flat-rate deposit)
        assertThat(ProductValidator.ok(v(y.replace("rate_type: TIERED", "rate_type: FIXED\n  rate: 0.01")))).isTrue();
        // deposit config on a loan, and tiered pricing on a loan, are rejected
        assertThat(v(y.replace("family: DEPOSIT", "family: LOAN"))).anyMatch(i -> i.path().equals("deposit"));
        assertThat(v("product: SOME_LOAN\nversion: 1\nfamily: LOAN\ncurrency: THB\npricing: { rate_type: TIERED }\n"
                + "accounting: { gl_mapping: x }")).anyMatch(i -> i.path().equals("pricing.rate_type"));
        // no deposit block on a plain fixed-rate deposit is fine
        assertThat(ProductValidator.ok(v("product: SAVINGS_X\nversion: 1\nfamily: DEPOSIT\ncurrency: THB\n"
                + "pricing: { rate_type: FIXED, rate: 0.01 }\naccounting: { gl_mapping: x }"))).isTrue();
        // an empty tier list, and a tier with no rate
        assertThat(v(y.replaceAll("(?s)tiers:.*?wht_rate", "tiers: []\n  wht_rate"))).anyMatch(i -> i.path().equals("deposit.tiers"));
        assertThat(v(y.replace("{ up_to: 100000, rate: 0.0100 }", "{ up_to: 100000 }"))).anyMatch(i -> i.path().endsWith(".rate"));
    }
}
