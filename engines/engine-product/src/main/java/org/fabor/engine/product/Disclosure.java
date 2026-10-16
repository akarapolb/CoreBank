package org.fabor.engine.product;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import org.fabor.engine.interest.Eir;
import org.fabor.engine.interest.Rates;
import org.fabor.engine.schedule.Frequency;
import org.fabor.engine.schedule.Installment;
import org.fabor.platform.money.Money;

/**
 * The cost-of-credit disclosure shown before a customer signs: the quoted rate, the effective annual rate of the
 * schedule, the all-in effective rate once up-front fees are counted (the amount actually received is the principal less
 * those fees), and the totals. Pure: built only from a product and its quote. The wording is configuration to confirm with
 * counsel and the regulator, like the rule packs.
 *
 * @param quotedRate          the rate in the product: a flat rate for flat pricing, the nominal annual rate otherwise
 * @param flat                whether {@code quotedRate} is a flat rate
 * @param effectiveRate       effective annual rate of the schedule alone
 * @param allInEffectiveRate  effective annual rate counting the up-front fees as a reduction of the amount advanced
 */
public record Disclosure(String product, int version, boolean flat, BigDecimal quotedRate, BigDecimal effectiveRate,
                         BigDecimal allInEffectiveRate, Money principal, Money upfrontFees, Money netAdvance,
                         int instalments, Money firstInstalment, Money totalInterest, Money totalPayable) {

    public static Disclosure of(ProductDefinition d, Money principal, ProductQuote.Result quote) {
        List<Installment> rows = quote.schedule().installments();
        Money fees = quote.disbursementFees().values().stream().reduce(Money.zero(principal.currency()), Money::plus);
        Money net = principal.minus(fees);
        if (net.minor() <= 0) {
            throw new IllegalArgumentException("Up-front fees leave nothing advanced to the customer");
        }
        List<Long> pays = rows.stream().map(i -> i.total().minor()).toList();
        BigDecimal allIn = fees.isZero() ? quote.disclosedEffectiveRate()
                : Rates.effectiveAnnual(Eir.periodicRate(net.minor(), pays), Frequency.valueOf(d.schedule().frequency()).perYear());
        boolean flat = d.pricing().rateType() == ProductDefinition.RateType.FLAT;
        return new Disclosure(d.product(), d.version(), flat, d.pricing().rate(), quote.disclosedEffectiveRate(), allIn,
                principal, fees, net, rows.size(), rows.get(0).total(), quote.schedule().totalInterest(),
                quote.schedule().totalPayable());
    }

    private static String percent(BigDecimal rate) {
        return rate.multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP).toPlainString() + "% a year";
    }

    /** The disclosure as plain lines, one fact per line, in the order a customer reads them. */
    public List<String> lines() {
        List<String> out = new ArrayList<>();
        out.add("Product " + product + " (version " + version + ")");
        out.add("Amount of credit: " + principal);
        if (!upfrontFees.isZero()) {
            out.add("Fees paid at disbursement: " + upfrontFees + "; amount you receive: " + netAdvance);
        }
        out.add((flat ? "Quoted flat rate: " : "Nominal interest rate: ") + percent(quotedRate));
        out.add("Effective interest rate (EIR): " + percent(effectiveRate));
        if (!upfrontFees.isZero()) {
            out.add("Effective rate including fees: " + percent(allInEffectiveRate));
        }
        out.add("Repayments: " + instalments + " instalments, the first of " + firstInstalment);
        out.add("Total interest: " + totalInterest);
        out.add("Total payable: " + totalPayable);
        return out;
    }

    public String text() {
        return String.join("\n", lines());
    }
}
