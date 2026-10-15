package org.fabor.engine.tax;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.constraints.LongRange;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.junit.jupiter.api.Test;

class TaxTest {
    static Money thb(long m) {
        return Money.ofMinor(m, Currency.THB);
    }

    static final BigDecimal SEVEN = new BigDecimal("0.07");

    @Test
    void exclusiveAndInclusive() {
        var ex = Vat.exclusive(thb(1_000_000), SEVEN);
        assertThat(ex.vat().minor()).isEqualTo(70_000);
        assertThat(ex.gross().minor()).isEqualTo(1_070_000);
        var in = Vat.inclusive(thb(1_070_000), SEVEN);
        assertThat(in.vat().minor()).isEqualTo(70_000);
        assertThat(in.base().minor()).isEqualTo(1_000_000);
        assertThat(Vat.exclusive(thb(1_000_000), BigDecimal.ZERO).vat().isZero()).isTrue();
        assertThatThrownBy(() -> Vat.exclusive(thb(1), new BigDecimal("0.9"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Vat.inclusive(thb(1), new BigDecimal("-0.1"))).isInstanceOf(IllegalArgumentException.class);
    }

    @Property
    void splitsAlwaysAddUp(@ForAll @LongRange(min = 0, max = 10_000_000_000L) long amount) {
        var ex = Vat.exclusive(thb(amount), SEVEN);
        assertThat(ex.base().plus(ex.vat())).isEqualTo(ex.gross());
        var in = Vat.inclusive(thb(amount), SEVEN);
        assertThat(in.base().plus(in.vat())).isEqualTo(in.gross());
        assertThat(in.vat().minor()).isLessThanOrEqualTo(amount);
    }

    @Test
    void invoiceTotalsAreValidatedAndXmlIsEscaped() {
        var l1 = new TaxInvoice.Line("Instalment 1 & fee <A>", thb(100_000), thb(7_000));
        var l2 = new TaxInvoice.Line("Instalment 1 vehicle 2", thb(50_000), thb(3_500));
        TaxInvoice inv = TaxInvoice.of("INV-2026-000001", LocalDate.of(2026, 2, 16), "0105500000001", "party-1", List.of(l1, l2));
        assertThat(inv.gross().minor()).isEqualTo(160_500);
        assertThat(inv.vat().minor()).isEqualTo(10_500);
        String xml = inv.toXml();
        assertThat(xml).contains("Instalment 1 &amp; fee &lt;A&gt;").contains("<Gross currency=\"THB\">1605.00</Gross>");
        assertThatThrownBy(() -> new TaxInvoice("N", LocalDate.of(2026, 1, 1), "T", "b", List.of(l1), thb(100_000), thb(7_000), thb(1)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> TaxInvoice.of("N", LocalDate.of(2026, 1, 1), "T", "b", List.of())).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> TaxInvoice.of("", LocalDate.of(2026, 1, 1), "T", "b", List.of(l1))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new TaxInvoice("N", LocalDate.of(2026, 1, 1), "T", "b", List.of(), thb(0), thb(0), thb(0)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void invoiceRequiredFields() {
        var l = new TaxInvoice.Line("x", thb(100), thb(7));
        for (String[] bad : new String[][] {{null, "T"}, {" ", "T"}, {"N", null}, {"N", " "}}) {
            assertThatThrownBy(() -> TaxInvoice.of(bad[0], LocalDate.of(2026, 1, 1), bad[1], "b", List.of(l)))
                    .isInstanceOf(IllegalArgumentException.class);
        }
        // a mismatched VAT total is caught even when the base matches
        assertThatThrownBy(() -> new TaxInvoice("N", LocalDate.of(2026, 1, 1), "T", "b", List.of(l), thb(100), thb(8), thb(108)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new TaxInvoice("N", LocalDate.of(2026, 1, 1), "T", "b", List.of(l), thb(101), thb(7), thb(108)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void instalmentVatTaxesTheChosenBase() {
        // instalment of 10,000.00 = 8,500.00 principal + 1,500.00 interest
        var onInterest = InstalmentVat.of(thb(850_000), thb(150_000), InstalmentVat.Base.INTEREST, SEVEN);
        assertThat(onInterest.base().minor()).isEqualTo(150_000);
        assertThat(onInterest.vat().minor()).isEqualTo(10_500);
        var onTotal = InstalmentVat.of(thb(850_000), thb(150_000), InstalmentVat.Base.TOTAL, SEVEN);
        assertThat(onTotal.base().minor()).isEqualTo(1_000_000);
        assertThat(onTotal.vat().minor()).isEqualTo(70_000);
        TaxInvoice inv = InstalmentVat.invoice("HP-1", 3, LocalDate.of(2026, 4, 15), "0105500000001", "party-1", onTotal);
        assertThat(inv.number()).isEqualTo("INV-HP-1-I3");
        assertThat(inv.gross().minor()).isEqualTo(1_070_000);
        assertThat(inv.lines()).singleElement().extracting(TaxInvoice.Line::description).isEqualTo("Instalment 3 of HP-1");
    }
}
