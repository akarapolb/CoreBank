package org.fabor.engine.tax;

import java.time.LocalDate;
import java.util.List;
import org.fabor.platform.money.Money;

/**
 * Tax invoice data for one billing event. Internal representation: delivery to the Revenue Department needs a
 * signed e-Tax invoice produced by an accredited service provider, which consumes {@link #toXml()}-style data.
 * Totals are validated on construction: the sum of lines must equal the invoice totals, base plus VAT equals gross.
 */
public record TaxInvoice(String number, LocalDate date, String sellerTaxId, String buyerRef, List<Line> lines,
                         Money base, Money vat, Money gross) {

    public record Line(String description, Money base, Money vat) { }

    public TaxInvoice {
        if (number == null || number.isBlank() || sellerTaxId == null || sellerTaxId.isBlank()) {
            throw new IllegalArgumentException("Invoice number and seller tax id are required");
        }
        if (lines.isEmpty()) {
            throw new IllegalArgumentException("An invoice needs at least one line");
        }
        Money b = Money.zero(base.currency());
        Money v = Money.zero(base.currency());
        for (Line l : lines) {
            b = b.plus(l.base());
            v = v.plus(l.vat());
        }
        if (!b.equals(base) || !v.equals(vat) || !base.plus(vat).equals(gross)) {
            throw new IllegalArgumentException("Invoice totals do not match its lines");
        }
        lines = List.copyOf(lines);
    }

    public static TaxInvoice of(String number, LocalDate date, String sellerTaxId, String buyerRef, List<Line> lines) {
        if (lines.isEmpty()) {
            throw new IllegalArgumentException("An invoice needs at least one line");
        }
        Money b = Money.zero(lines.get(0).base().currency());
        Money v = b;
        for (Line l : lines) {
            b = b.plus(l.base());
            v = v.plus(l.vat());
        }
        return new TaxInvoice(number, date, sellerTaxId, buyerRef, lines, b, v, b.plus(v));
    }

    public String toXml() {
        StringBuilder sb = new StringBuilder("<TaxInvoice>\n");
        sb.append("  <Number>").append(esc(number)).append("</Number>\n");
        sb.append("  <Date>").append(date).append("</Date>\n");
        sb.append("  <SellerTaxId>").append(esc(sellerTaxId)).append("</SellerTaxId>\n");
        sb.append("  <BuyerRef>").append(esc(buyerRef)).append("</BuyerRef>\n");
        for (Line l : lines) {
            sb.append("  <Line description=\"").append(esc(l.description())).append("\" base=\"").append(l.base().toMajor().toPlainString())
                    .append("\" vat=\"").append(l.vat().toMajor().toPlainString()).append("\"/>\n");
        }
        sb.append("  <Base>").append(base.toMajor().toPlainString()).append("</Base>\n");
        sb.append("  <Vat>").append(vat.toMajor().toPlainString()).append("</Vat>\n");
        sb.append("  <Gross currency=\"").append(gross.currency().code()).append("\">").append(gross.toMajor().toPlainString())
                .append("</Gross>\n</TaxInvoice>\n");
        return sb.toString();
    }

    private static String esc(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
