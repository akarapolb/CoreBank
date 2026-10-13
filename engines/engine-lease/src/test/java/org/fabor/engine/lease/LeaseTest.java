package org.fabor.engine.lease;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.constraints.IntRange;
import net.jqwik.api.constraints.LongRange;
import org.fabor.engine.lease.FinanceLease.Timing;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.junit.jupiter.api.Test;

class LeaseTest {
    static Money thb(long m) {
        return Money.ofMinor(m, Currency.THB);
    }

    @Test
    void financeLeaseImplicitRateAndRunOff() {
        // 1,000,000 asset, 36 monthly payments of 27,500 in arrears, 200,000 residual
        var r = FinanceLease.fromPayment(thb(100_000_000), thb(0), thb(2_750_000), 36, thb(20_000_000), Timing.ARREARS, 12);
        assertThat(r.rows()).hasSize(36);
        assertThat(r.rows().get(35).closing()).isEqualTo(thb(20_000_000));                       // ends at the residual
        long paid = r.rows().stream().mapToLong(x -> x.payment().minor()).sum();
        assertThat(r.totalIncome().minor()).isEqualTo(paid + 20_000_000 - 100_000_000);           // income = receipts - investment
        assertThat(r.annualRate().doubleValue()).isBetween(0.099, 0.102);
        assertThat(r.rows().get(0).income().minor()).isEqualTo(
                thb(100_000_000).times(r.periodicRate(), RoundingMode.HALF_UP).minor());
        // income falls over time as the balance is repaid
        assertThat(r.rows().get(1).income().minor()).isLessThan(r.rows().get(0).income().minor());
    }

    @Test
    void paymentInAdvanceAndDirectCosts() {
        var arrears = FinanceLease.fromPayment(thb(100_000_000), thb(0), thb(3_000_000), 36, thb(0), Timing.ARREARS, 12);
        var advance = FinanceLease.fromPayment(thb(100_000_000), thb(0), thb(3_000_000), 36, thb(0), Timing.ADVANCE, 12);
        assertThat(advance.periodicRate()).isGreaterThan(arrears.periodicRate());   // paying earlier means a higher implicit rate
        assertThat(advance.rows().get(35).closing().isZero()).isTrue();
        var withCosts = FinanceLease.fromPayment(thb(100_000_000), thb(500_000), thb(3_000_000), 36, thb(0), Timing.ARREARS, 12);
        assertThat(withCosts.initialNetInvestment()).isEqualTo(thb(100_500_000));
        assertThat(withCosts.periodicRate()).isLessThan(arrears.periodicRate());    // costs lower the implicit rate
        var single = FinanceLease.fromPayment(thb(1_000_000), thb(0), thb(300_000), 1, thb(800_000), Timing.ADVANCE, 12);
        assertThat(single.rows()).hasSize(1);
        assertThatThrownBy(() -> FinanceLease.fromPayment(thb(100), thb(0), thb(100), 3, thb(0), Timing.ADVANCE, 12))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> FinanceLease.fromPayment(thb(100), thb(0), thb(10), 0, thb(0), Timing.ARREARS, 12))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Property
    void netInvestmentAlwaysEndsAtResidual(@ForAll @LongRange(min = 1_000_000, max = 2_000_000_000L) long fv,
                                           @ForAll @IntRange(min = 6, max = 84) int n,
                                           @ForAll @IntRange(min = 0, max = 30) int residualPct) {
        long residual = fv * residualPct / 100;
        long payment = (fv - residual / 2) / n + fv / (n * 20L) + 1;      // comfortably covers the investment
        var r = FinanceLease.fromPayment(thb(fv), thb(0), thb(payment), n, thb(residual), Timing.ARREARS, 12);
        assertThat(r.rows().get(n - 1).closing().minor()).isEqualTo(residual);
        long paid = payment * n;
        assertThat(r.totalIncome().minor()).isEqualTo(paid + residual - fv);
    }

    @Test
    void operatingLeaseStraightLinesRentAndDepreciation() {
        // 6 months, first two rent-free: billed 0,0,60k,60k,60k,60k -> recognised 40k a month
        List<Money> billed = List.of(thb(0), thb(0), thb(6_000_000), thb(6_000_000), thb(6_000_000), thb(6_000_000));
        var r = OperatingLease.schedule(thb(120_000_000), thb(60_000_000), billed);
        assertThat(r.totalRent()).isEqualTo(thb(24_000_000));
        assertThat(r.rows().stream().mapToLong(x -> x.recognisedRent().minor()).sum()).isEqualTo(24_000_000);
        assertThat(r.rows().get(0).recognisedRent()).isEqualTo(thb(4_000_000));
        assertThat(r.rows().get(0).accruedRent()).isEqualTo(thb(4_000_000));                     // earned but not yet billed
        assertThat(r.rows().get(5).accruedRent().isZero()).isTrue();                              // balance runs off to zero
        assertThat(r.rows().get(5).netBookValue()).isEqualTo(thb(60_000_000));                    // depreciated to residual
        assertThat(r.totalDepreciation()).isEqualTo(thb(60_000_000));
        assertThatThrownBy(() -> OperatingLease.schedule(thb(100), thb(200), billed)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> OperatingLease.schedule(thb(100), thb(0), List.of())).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void journalPlansBalanceAndFollowTheRows() {
        var fl = FinanceLease.fromPayment(thb(10_000_000), thb(0), thb(300_000), 36, thb(0), Timing.ARREARS, 12);
        assertThat(LeaseJournal.financeLeaseInception(fl.initialNetInvestment())).hasSize(1);
        var lines = LeaseJournal.financeLeasePeriod(fl.rows().get(0));
        assertThat(lines).extracting(LeaseJournal.Line::debit).containsExactly("NET_INVESTMENT_IN_LEASE", "CASH");
        // net effect on the net investment account over the life equals the schedule's closing balance
        long net = 0;
        for (var row : fl.rows()) {
            for (var l : LeaseJournal.financeLeasePeriod(row)) {
                if (l.debit().equals("NET_INVESTMENT_IN_LEASE")) {
                    net += l.amount().minor();
                }
                if (l.credit().equals("NET_INVESTMENT_IN_LEASE")) {
                    net -= l.amount().minor();
                }
            }
        }
        assertThat(fl.initialNetInvestment().minor() + net).isEqualTo(fl.rows().get(35).closing().minor());

        var op = OperatingLease.schedule(thb(1_200_000), thb(0), List.of(thb(0), thb(200_000), thb(200_000)));
        assertThat(LeaseJournal.operatingLeaseInception(thb(1_200_000)).get(0).debit()).isEqualTo("LEASED_ASSETS");
        List<LeaseJournal.Line> first = LeaseJournal.operatingLeasePeriod(op.rows().get(0));
        assertThat(first).extracting(LeaseJournal.Line::debit).contains("ACCRUED_RENT", "DEPRECIATION_EXPENSE");
        List<LeaseJournal.Line> last = LeaseJournal.operatingLeasePeriod(op.rows().get(2));
        assertThat(last).extracting(LeaseJournal.Line::credit).contains("DEFERRED_RENT");
        // billing equal to recognition needs no adjustment line
        var flat = OperatingLease.schedule(thb(600_000), thb(0), List.of(thb(100_000), thb(100_000)));
        assertThat(LeaseJournal.operatingLeasePeriod(flat.rows().get(0))).hasSize(2);
        assertThat(new ArrayList<>(List.of(BigDecimal.ONE))).isNotEmpty();
    }
}
