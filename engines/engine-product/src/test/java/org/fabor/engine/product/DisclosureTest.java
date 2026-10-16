package org.fabor.engine.product;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.Set;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.time.BusinessCalendar;
import org.junit.jupiter.api.Test;

class DisclosureTest {
    private static final Money PRINCIPAL = Money.of(new BigDecimal("100000"), Currency.THB);

    private static ProductQuote.Result quote(ProductDefinition d) {
        return ProductQuote.quote(d, PRINCIPAL, 12, LocalDate.of(2026, 1, 15), BusinessCalendar.monToFri(Set.of()));
    }

    @Test
    void anAnnuityWithoutFeesDisclosesTheNominalAndEffectiveRates() {
        ProductDefinition d = ProductLoader.parse(HirePurchaseRulesTest.CAR);
        Disclosure x = Disclosure.of(d, PRINCIPAL, quote(d));
        assertThat(x.flat()).isFalse();
        assertThat(x.upfrontFees().isZero()).isTrue();
        assertThat(x.allInEffectiveRate()).isEqualByComparingTo(x.effectiveRate());
        assertThat(x.lines()).contains("Nominal interest rate: 9.00% a year", "Repayments: 12 instalments, the first of "
                + x.firstInstalment());
        assertThat(x.lines()).noneMatch(l -> l.startsWith("Fees paid") || l.startsWith("Effective rate including"));
        assertThat(x.text()).contains("Effective interest rate (EIR): 9.38% a year").contains("Total payable: ");
    }

    @Test
    void aFlatRateProductSaysFlatAndItsEffectiveRateIsHigher() {
        String flat = HirePurchaseRulesTest.CAR.replace("rate_type: FIXED", "rate_type: FLAT")
                .replace("method: ANNUITY", "method: ANNUITY_FROM_FLAT").replace("rate: 0.09", "rate: 0.05");
        ProductDefinition d = ProductLoader.parse(flat);
        Disclosure x = Disclosure.of(d, PRINCIPAL, quote(d));
        assertThat(x.flat()).isTrue();
        assertThat(x.lines()).contains("Quoted flat rate: 5.00% a year");
        assertThat(x.effectiveRate()).isGreaterThan(new BigDecimal("0.08")).isLessThan(new BigDecimal("0.10"));
    }

    @Test
    void upFrontFeesRaiseTheAllInRateAndShrinkTheAmountReceived() {
        ProductDefinition d = ProductLoader.parse(HirePurchaseRulesTest.CAR);
        ProductQuote.Result q = quote(d);
        ProductQuote.Result withFee = new ProductQuote.Result(q.schedule(),
                Map.of("ORIGINATION_FEE", Money.of(new BigDecimal("1000"), Currency.THB)), q.disclosedEffectiveRate());
        Disclosure x = Disclosure.of(d, PRINCIPAL, withFee);
        assertThat(x.netAdvance()).isEqualTo(Money.of(new BigDecimal("99000"), Currency.THB));
        assertThat(x.allInEffectiveRate()).isGreaterThan(x.effectiveRate());
        assertThat(x.lines()).anyMatch(l -> l.startsWith("Fees paid at disbursement: ") && l.contains("amount you receive: "))
                .anyMatch(l -> l.startsWith("Effective rate including fees: "));
    }

    @Test
    void feesThatConsumeTheWholeAdvanceAreRefused() {
        ProductDefinition d = ProductLoader.parse(HirePurchaseRulesTest.CAR);
        ProductQuote.Result q = quote(d);
        ProductQuote.Result all = new ProductQuote.Result(q.schedule(), Map.of("F", PRINCIPAL), q.disclosedEffectiveRate());
        assertThatThrownBy(() -> Disclosure.of(d, PRINCIPAL, all)).isInstanceOf(IllegalArgumentException.class);
    }
}
