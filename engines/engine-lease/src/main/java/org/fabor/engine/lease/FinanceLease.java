package org.fabor.engine.lease;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import org.fabor.engine.interest.Eir;
import org.fabor.engine.interest.Rates;
import org.fabor.platform.money.Money;

/**
 * Lessor accounting for a finance lease (TFRS 16 / IFRS 16): the asset leaves the books and a net investment in
 * the lease is recognised, earning finance income at the rate implicit in the lease. Pure and deterministic.
 *
 * <p>Net investment starts at fair value plus initial direct costs. Each period: income = opening x rate, then the
 * payment reduces it. At the end it equals the residual value (guaranteed plus unguaranteed) that the lessor expects
 * to realise. Rounding differences land in the last period's income.
 */
public final class FinanceLease {
    public enum Timing { ARREARS, ADVANCE }

    public record Row(int period, Money opening, Money income, Money payment, Money closing) { }

    public record Result(BigDecimal periodicRate, BigDecimal annualRate, Money initialNetInvestment, List<Row> rows,
                         Money totalIncome) { }

    private FinanceLease() { }

    /**
     * @param fairValue fair value of the asset at inception
     * @param directCosts initial direct costs added to the net investment
     * @param payment level periodic payment (excluding VAT)
     * @param periods number of payments
     * @param residual residual value expected at the end (not paid by the lessee unless guaranteed and called)
     */
    public static Result fromPayment(Money fairValue, Money directCosts, Money payment, int periods, Money residual,
                                     Timing timing, int periodsPerYear) {
        if (periods < 1) {
            throw new IllegalArgumentException("periods must be at least 1");
        }
        long invest = fairValue.minor() + directCosts.minor();
        List<Long> flows = new ArrayList<>();
        long advanced = invest;
        if (timing == Timing.ADVANCE) {
            advanced -= payment.minor();            // first payment is received at inception
            for (int i = 2; i <= periods; i++) {
                flows.add(payment.minor());
            }
            flows.add(residual.minor());           // received one period after the last payment
            if (periods == 1) {
                flows.clear();
                flows.add(residual.minor());
            }
        } else {
            for (int i = 1; i <= periods; i++) {
                flows.add(payment.minor() + (i == periods ? residual.minor() : 0));
            }
        }
        if (advanced <= 0) {
            throw new IllegalArgumentException("Payment covers the whole investment at inception");
        }
        BigDecimal r = Eir.periodicRate(advanced, flows);
        return schedule(fairValue, directCosts, payment, periods, residual, timing, r, periodsPerYear);
    }

    static Result schedule(Money fairValue, Money directCosts, Money payment, int periods, Money residual, Timing timing,
                           BigDecimal r, int periodsPerYear) {
        Money open = fairValue.plus(directCosts);
        Money initial = open;
        List<Row> rows = new ArrayList<>();
        Money totalIncome = Money.zero(open.currency());
        for (int p = 1; p <= periods; p++) {
            Money pay = payment;
            Money income;
            Money closing;
            if (timing == Timing.ARREARS) {
                income = open.times(r, RoundingMode.HALF_UP);
                closing = open.plus(income).minus(pay);
            } else {
                // payment first, then interest accrues on the reduced balance
                Money afterPay = open.minus(pay);
                income = afterPay.times(r, RoundingMode.HALF_UP);
                closing = afterPay.plus(income);
            }
            if (p == periods) {
                // absorb rounding so the net investment ends exactly at the residual
                income = income.plus(residual.minus(closing));
                closing = residual;
            }
            rows.add(new Row(p, open, income, pay, closing));
            totalIncome = totalIncome.plus(income);
            open = closing;
        }
        return new Result(r, annual(r, periodsPerYear), initial, List.copyOf(rows), totalIncome);
    }

    private static BigDecimal annual(BigDecimal periodic, int perYear) {
        return periodic.multiply(BigDecimal.valueOf(perYear), Rates.MC).setScale(8, RoundingMode.HALF_UP);
    }
}
