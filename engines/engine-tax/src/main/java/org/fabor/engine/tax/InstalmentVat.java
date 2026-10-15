package org.fabor.engine.tax;

import java.math.BigDecimal;
import java.time.LocalDate;
import org.fabor.platform.money.Money;

/**
 * VAT on one instalment of a financing contract. Which part of the instalment is taxable depends on the product and
 * the tax advice behind it, so the base is a choice, not a rule: {@link Base#INTEREST} taxes the interest part only,
 * {@link Base#TOTAL} taxes the whole instalment (typical of operating-lease rentals). The result is exclusive: VAT is
 * added to what the customer owes, and the invoice shows base, VAT and gross per instalment.
 */
public final class InstalmentVat {
    public enum Base { INTEREST, TOTAL }

    private InstalmentVat() { }

    /** VAT on an instalment made of {@code principal} and {@code interest}. */
    public static Vat.Split of(Money principal, Money interest, Base base, BigDecimal rate) {
        Money taxable = base == Base.TOTAL ? principal.plus(interest) : interest;
        return Vat.exclusive(taxable, rate);
    }

    /** The tax invoice for instalment {@code number} of contract {@code contractId}. */
    public static TaxInvoice invoice(String contractId, int number, LocalDate date, String sellerTaxId, String buyerRef,
                                     Vat.Split split) {
        return TaxInvoice.of("INV-" + contractId + "-I" + number, date, sellerTaxId, buyerRef,
                java.util.List.of(new TaxInvoice.Line("Instalment " + number + " of " + contractId, split.base(), split.vat())));
    }
}
