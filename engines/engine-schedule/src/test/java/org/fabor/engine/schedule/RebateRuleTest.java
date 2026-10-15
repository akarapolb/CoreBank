package org.fabor.engine.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Set;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.constraints.BigRange;
import net.jqwik.api.constraints.IntRange;
import net.jqwik.api.constraints.LongRange;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.time.BusinessCalendar;
import org.fabor.platform.time.BusinessCalendar.Convention;
import org.junit.jupiter.api.Test;

class RebateRuleTest {
    static final BusinessCalendar CAL = BusinessCalendar.monToFri(Set.of());

    static Schedule schedule(long principal, String rate, int n, Method m) {
        return ScheduleEngine.build(new ScheduleRequest(Money.ofMinor(principal, Currency.THB), new BigDecimal(rate), n,
                Frequency.MONTHLY, LocalDate.of(2026, 1, 15), null, m, null, 0, CAL, Convention.FOLLOWING,
                RoundingMode.HALF_UP));
    }

    static Money unbilledInterest(Schedule s, int billed) {
        return s.installments().subList(billed, s.installments().size()).stream().map(Installment::interest)
                .reduce(Money.zero(Currency.THB), Money::plus);
    }

    @Test
    void parsesEveryForm() {
        assertThat(RebateRule.parse("ACTUARIAL").kind()).isEqualTo(RebateRule.Kind.ACTUARIAL);
        assertThat(RebateRule.parse("EIR").kind()).isEqualTo(RebateRule.Kind.ACTUARIAL);
        assertThat(RebateRule.parse("NONE").kind()).isEqualTo(RebateRule.Kind.ACTUARIAL);
        assertThat(RebateRule.parse(" RULE_OF_78 ").kind()).isEqualTo(RebateRule.Kind.RULE_OF_78);
        assertThat(RebateRule.parse("PERCENT:0.5").kind()).isEqualTo(RebateRule.Kind.PERCENT);
        assertThat(RebateRule.parse("TIERED:0.6,0.7,1").kind()).isEqualTo(RebateRule.Kind.TIERED);
    }

    @Test
    void rejectsMalformedRules() {
        for (String bad : new String[] {null, "", "  ", "NOPE", "PERCENT:abc", "PERCENT:1.5", "PERCENT:-0.1",
                "TIERED:0.6,0.7", "TIERED:0.6,0.7,x", "TIERED:0.6,0.7,2"}) {
            assertThatThrownBy(() -> RebateRule.parse(bad)).as(String.valueOf(bad))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    void actuarialExcusesAllUnbilledInterest() {
        Schedule s = schedule(10_000_000, "0.12", 12, Method.ANNUITY);
        Money rebate = RebateRule.parse("ACTUARIAL").rebate(s, 4);
        assertThat(rebate).isEqualTo(unbilledInterest(s, 4));
        assertThat(rebate.minor()).isPositive();
    }

    @Test
    void percentExcusesAFixedShare() {
        Schedule s = schedule(10_000_000, "0.12", 12, Method.ANNUITY);
        Money unbilled = unbilledInterest(s, 3);
        assertThat(RebateRule.parse("PERCENT:0.5").rebate(s, 3)).isEqualTo(unbilled.times(new BigDecimal("0.5"), RoundingMode.HALF_UP));
        assertThat(RebateRule.parse("PERCENT:0").rebate(s, 3).minor()).isZero();
    }

    @Test
    void tiersFollowHowMuchOfTheTermIsPaid() {
        RebateRule r = RebateRule.parse("TIERED:0.6,0.7,1");
        // 36 instalments: up to 12 paid -> 0.6; 13..24 paid -> 0.7; beyond -> 1
        assertThat(r.fractionAt(36, 36)).isEqualByComparingTo("0.6");
        assertThat(r.fractionAt(36, 24)).isEqualByComparingTo("0.6"); // exactly one third paid
        assertThat(r.fractionAt(36, 23)).isEqualByComparingTo("0.7");
        assertThat(r.fractionAt(36, 12)).isEqualByComparingTo("0.7"); // exactly two thirds paid
        assertThat(r.fractionAt(36, 11)).isEqualByComparingTo("1");
        assertThat(RebateRule.parse("ACTUARIAL").fractionAt(36, 20)).isEqualByComparingTo("1");
        assertThat(RebateRule.parse("PERCENT:0.4").fractionAt(36, 20)).isEqualByComparingTo("0.4");
        assertThatThrownBy(() -> RebateRule.parse("RULE_OF_78").fractionAt(36, 20)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void ruleOf78IsNeverMoreGenerousThanActuarial() {
        // 12 flat-rate instalments, 4 billed, 8 left: unearned share is 8*9 / (12*13) = 72/156 of the total interest
        Schedule s = schedule(10_000_000, "0.10", 12, Method.ANNUITY_FROM_FLAT);
        Money r78 = RebateRule.parse("RULE_OF_78").rebate(s, 4);
        Money expected = s.totalInterest().times(BigDecimal.valueOf(72).divide(BigDecimal.valueOf(156),
                java.math.MathContext.DECIMAL128), RoundingMode.HALF_UP);
        assertThat(r78).isEqualTo(expected);
        assertThat(r78.compareTo(RebateRule.parse("ACTUARIAL").rebate(s, 4))).isLessThanOrEqualTo(0);
    }

    @Test
    void nothingToExcuseWhenNothingIsLeftOrNothingIsUnbilled() {
        Schedule s = schedule(10_000_000, "0.12", 12, Method.ANNUITY);
        assertThat(RebateRule.parse("ACTUARIAL").rebate(s, 12).minor()).isZero();
        Schedule zeroRate = schedule(10_000_000, "0", 12, Method.ANNUITY);
        assertThat(RebateRule.parse("PERCENT:1").rebate(zeroRate, 3).minor()).isZero();
        assertThatThrownBy(() -> RebateRule.parse("ACTUARIAL").rebate(s, 13)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> RebateRule.parse("ACTUARIAL").rebate(s, -1)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void ruleOf78IsCappedAtTheInterestStillUnbilled() {
        // interest more front-loaded than the 78ths assume: 900 / 100 / 0 of 1,000. One instalment billed, two left:
        // 78ths would excuse 6/12 of 1,000 = 500, but only 100 is still unbilled
        Money zero = Money.zero(Currency.THB);
        java.util.List<Installment> rows = java.util.List.of(
                row(1, 900), row(2, 100), row(3, 0));
        Schedule s = new Schedule(rows, BigDecimal.ZERO, BigDecimal.ZERO, Money.ofMinor(1000, Currency.THB), zero);
        assertThat(RebateRule.parse("RULE_OF_78").rebate(s, 1).minor()).isEqualTo(100);
    }

    private static Installment row(int n, long interest) {
        Money i = Money.ofMinor(interest, Currency.THB);
        Money zero = Money.zero(Currency.THB);
        return new Installment(n, LocalDate.of(2026, n, 15), zero, i, i, zero);
    }

    @Property
    void rebateIsAlwaysBetweenZeroAndUnbilledInterest(@ForAll @LongRange(min = 1_000_000, max = 2_000_000_000L) long principal,
                                                      @ForAll @BigRange(min = "0.01", max = "0.20") BigDecimal rate,
                                                      @ForAll @IntRange(min = 6, max = 72) int n,
                                                      @ForAll @IntRange(min = 0, max = 100) int billedPercent) {
        Schedule s = schedule(principal, rate.toPlainString(), n, Method.ANNUITY_FROM_FLAT);
        int billed = n * billedPercent / 100;
        Money unbilled = unbilledInterest(s, billed);
        for (String rule : new String[] {"ACTUARIAL", "RULE_OF_78", "PERCENT:0.5", "TIERED:0.6,0.7,1"}) {
            Money rebate = RebateRule.parse(rule).rebate(s, billed);
            assertThat(rebate.minor()).as(rule).isBetween(0L, unbilled.minor());
        }
    }
}
