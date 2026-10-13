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

class ScheduleEngineTest {
    static final BusinessCalendar CAL = BusinessCalendar.monToFri(Set.of());
    static final LocalDate D0 = LocalDate.of(2026, 1, 15);

    static Money thb(long minor) {
        return Money.ofMinor(minor, Currency.THB);
    }

    static ScheduleRequest req(long principal, String rate, int n, Method m, long balloon, int io) {
        return new ScheduleRequest(thb(principal), new BigDecimal(rate), n, Frequency.MONTHLY, D0, null, m, thb(balloon),
                io, CAL, Convention.FOLLOWING, RoundingMode.HALF_UP);
    }

    static void assertInvariants(Schedule s, long principal) {
        long sum = 0;
        LocalDate prev = null;
        for (Installment i : s.installments()) {
            assertThat(i.principal().minor()).isGreaterThanOrEqualTo(0);
            assertThat(i.interest().minor()).isGreaterThanOrEqualTo(0);
            assertThat(i.total()).isEqualTo(i.principal().plus(i.interest()));
            if (prev != null) {
                assertThat(i.dueDate()).isAfter(prev);
            }
            prev = i.dueDate();
            sum += i.principal().minor();
        }
        assertThat(sum).isEqualTo(principal);
        assertThat(s.installments().get(s.installments().size() - 1).closingBalance().minor()).isZero();
        assertThat(s.totalPayable().minor()).isEqualTo(principal + s.totalInterest().minor());
    }

    @Test
    void annuityGolden() {
        Schedule s = ScheduleEngine.build(req(10_000_000, "0.12", 12, Method.ANNUITY, 0, 0));
        assertThat(s.installments().get(0).total().minor()).isEqualTo(888_488); // 8,884.88
        assertThat(s.installments().get(0).interest().minor()).isEqualTo(100_000); // 1,000.00
        assertInvariants(s, 10_000_000);
        assertThat(s.periodicEir().setScale(6, RoundingMode.HALF_UP)).isEqualByComparingTo("0.010000");
        assertThat(s.effectiveAnnualRate().setScale(4, RoundingMode.HALF_UP)).isEqualByComparingTo("0.1268");
    }

    @Test
    void zeroRateAnnuity() {
        Schedule s = ScheduleEngine.build(req(1_200_000, "0", 12, Method.ANNUITY, 0, 0));
        assertThat(s.totalInterest().minor()).isZero();
        assertThat(s.installments().get(0).total().minor()).isEqualTo(100_000);
        assertInvariants(s, 1_200_000);
    }

    @Test
    void balloonAndInterestOnly() {
        Schedule s = ScheduleEngine.build(req(10_000_000, "0.09", 36, Method.ANNUITY, 2_000_000, 3));
        assertInvariants(s, 10_000_000);
        assertThat(s.installments().get(0).principal().minor()).isZero();
        assertThat(s.installments().get(2).principal().minor()).isZero();
        assertThat(s.installments().get(3).principal().minor()).isPositive();
        // the final payment carries the balloon
        assertThat(s.installments().get(35).principal().minor()).isGreaterThanOrEqualTo(2_000_000);
    }

    @Test
    void equalPrincipalAndBullet() {
        Schedule ep = ScheduleEngine.build(req(1_000_001, "0.06", 10, Method.EQUAL_PRINCIPAL, 0, 0));
        assertInvariants(ep, 1_000_001);
        assertThat(ep.installments().get(0).principal().minor()).isEqualTo(100_001);
        assertThat(ep.installments().get(0).interest().minor()).isGreaterThan(ep.installments().get(9).interest().minor());
        Schedule b = ScheduleEngine.build(req(1_000_000, "0.06", 6, Method.BULLET, 0, 0));
        assertInvariants(b, 1_000_000);
        assertThat(b.installments().get(0).interest().minor()).isEqualTo(5_000);
        assertThat(b.installments().get(5).principal().minor()).isEqualTo(1_000_000);
        Schedule epIo = ScheduleEngine.build(req(1_000_000, "0.06", 10, Method.EQUAL_PRINCIPAL, 200_000, 2));
        assertInvariants(epIo, 1_000_000);
    }

    @Test
    void hirePurchaseFromFlatRate() {
        // 500,000.00, 4.25% flat, 60 months: interest 106,250.00, payable 606,250.00
        Schedule s = ScheduleEngine.build(req(50_000_000, "0.0425", 60, Method.ANNUITY_FROM_FLAT, 0, 0));
        assertThat(s.totalInterest().minor()).isEqualTo(10_625_000);
        assertThat(s.installments().get(0).total().minor()).isEqualTo(1_010_417);
        assertThat(s.installments().get(59).total().minor()).isEqualTo(60_625_000 - 1_010_417L * 59);
        assertInvariants(s, 50_000_000);
        // the effective rate is well above the flat rate (about 8.1% a year, as an effective rate)
        assertThat(s.effectiveAnnualRate()).isBetween(new BigDecimal("0.080"), new BigDecimal("0.083"));
    }

    @Test
    void flatRateRejectsUnsupportedOptions() {
        assertThatThrownBy(() -> ScheduleEngine.build(req(1_000_000, "0.05", 12, Method.ANNUITY_FROM_FLAT, 100_000, 0)))
                .isInstanceOf(IllegalArgumentException.class);
        ScheduleRequest weekly = new ScheduleRequest(thb(1_000_000), new BigDecimal("0.05"), 12, Frequency.WEEKLY, D0,
                null, Method.ANNUITY_FROM_FLAT, null, 0, CAL, Convention.FOLLOWING, RoundingMode.HALF_UP);
        assertThatThrownBy(() -> ScheduleEngine.build(weekly)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void datesFollowCalendarAndDoNotDriftFromMonthEnd() {
        ScheduleRequest q = new ScheduleRequest(thb(1_200_000), new BigDecimal("0.06"), 4, Frequency.MONTHLY,
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31), Method.ANNUITY, null, 0,
                BusinessCalendar.monToFri(Set.of()), Convention.PRECEDING, RoundingMode.HALF_UP);
        Schedule s = ScheduleEngine.build(q);
        // 31 Jan (Sat) -> Fri 30 Jan; 28 Feb (Sat) -> Fri 27 Feb; 31 Mar (Tue); 30 Apr (Thu)
        assertThat(s.installments()).extracting(Installment::dueDate).containsExactly(
                LocalDate.of(2026, 1, 30), LocalDate.of(2026, 2, 27), LocalDate.of(2026, 3, 31), LocalDate.of(2026, 4, 30));
    }

    @Test
    void validation() {
        assertThatThrownBy(() -> req(0, "0.1", 12, Method.ANNUITY, 0, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> req(1000, "-0.1", 12, Method.ANNUITY, 0, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> req(1000, "0.1", 0, Method.ANNUITY, 0, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> req(1000, "0.1", 12, Method.ANNUITY, 1000, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> req(1000, "0.1", 12, Method.ANNUITY, 0, 12)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ScheduleRequest(thb(1000), BigDecimal.ONE, 12, Frequency.MONTHLY, D0, D0, Method.ANNUITY,
                null, 0, CAL, Convention.FOLLOWING, RoundingMode.HALF_UP)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ScheduleRequest(thb(1000), BigDecimal.ONE, 12, Frequency.MONTHLY, D0, null, Method.ANNUITY,
                Money.ofMinor(1, Currency.USD), 0, CAL, Convention.FOLLOWING, RoundingMode.HALF_UP))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void allFrequenciesProduceIncreasingDates() {
        for (Frequency f : Frequency.values()) {
            ScheduleRequest q = new ScheduleRequest(thb(1_000_000), new BigDecimal("0.08"), 8, f, D0, null, Method.ANNUITY,
                    null, 0, CAL, Convention.FOLLOWING, RoundingMode.HALF_UP);
            assertInvariants(ScheduleEngine.build(q), 1_000_000);
        }
        assertThat(Frequency.QUARTERLY.months()).isEqualTo(3);
        assertThat(Frequency.WEEKLY.months()).isEqualTo(-1);
        assertThat(Frequency.SEMI_ANNUAL.perYear()).isEqualTo(2);
    }

    @Property
    void annuityInvariantsHoldForAnyInput(@ForAll @LongRange(min = 100_000, max = 5_000_000_000L) long principal,
                                          @ForAll @BigRange(min = "0", max = "0.36") BigDecimal rate,
                                          @ForAll @IntRange(min = 1, max = 120) int n) {
        assertInvariants(ScheduleEngine.build(req(principal, rate.toPlainString(), n, Method.ANNUITY, 0, 0)), principal);
    }

    @Property
    void equalPrincipalInvariantsHold(@ForAll @LongRange(min = 100_000, max = 5_000_000_000L) long principal,
                                      @ForAll @BigRange(min = "0", max = "0.36") BigDecimal rate,
                                      @ForAll @IntRange(min = 1, max = 120) int n) {
        assertInvariants(ScheduleEngine.build(req(principal, rate.toPlainString(), n, Method.EQUAL_PRINCIPAL, 0, 0)),
                principal);
    }

    @Property
    void flatRateTotalIsExact(@ForAll @LongRange(min = 1_000_000, max = 5_000_000_000L) long principal,
                              @ForAll @BigRange(min = "0.01", max = "0.15") BigDecimal flat,
                              @ForAll @IntRange(min = 6, max = 84) int n) {
        Schedule s = ScheduleEngine.build(req(principal, flat.toPlainString(), n, Method.ANNUITY_FROM_FLAT, 0, 0));
        assertInvariants(s, principal);
        Money expected = org.fabor.engine.interest.Rates.flatInterest(thb(principal), flat, n, RoundingMode.HALF_UP);
        assertThat(s.totalInterest()).isEqualTo(expected);
    }

    @Property
    void tinyAmountsEitherSatisfyInvariantsOrAreRejected(@ForAll @LongRange(min = 100, max = 3_000) long principal,
                                                         @ForAll @BigRange(min = "0", max = "0.60") BigDecimal rate,
                                                         @ForAll @IntRange(min = 2, max = 36) int n) {
        for (Method m : new Method[] {Method.ANNUITY, Method.ANNUITY_FROM_FLAT}) {
            try {
                assertInvariants(ScheduleEngine.build(req(principal, rate.toPlainString(), n, m, 0, 0)), principal);
            } catch (IllegalArgumentException expected) {
                assertThat(expected.getMessage()).isNotBlank();
            }
        }
    }

    @Test
    void nullsAreRejected() {
        assertThatThrownBy(() -> new ScheduleRequest(null, BigDecimal.ONE, 1, Frequency.MONTHLY, D0, null, Method.ANNUITY,
                null, 0, CAL, Convention.FOLLOWING, RoundingMode.HALF_UP)).isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new ScheduleRequest(thb(1000), null, 1, Frequency.MONTHLY, D0, null, Method.ANNUITY,
                null, 0, CAL, Convention.FOLLOWING, RoundingMode.HALF_UP)).isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new ScheduleRequest(thb(1000), BigDecimal.ONE, 1, null, D0, null, Method.ANNUITY,
                null, 0, CAL, Convention.FOLLOWING, RoundingMode.HALF_UP)).isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new ScheduleRequest(thb(1000), BigDecimal.ONE, 1, Frequency.MONTHLY, null, null, Method.ANNUITY,
                null, 0, CAL, Convention.FOLLOWING, RoundingMode.HALF_UP)).isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new ScheduleRequest(thb(1000), BigDecimal.ONE, 1, Frequency.MONTHLY, D0, null, null,
                null, 0, CAL, Convention.FOLLOWING, RoundingMode.HALF_UP)).isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new ScheduleRequest(thb(1000), BigDecimal.ONE, 1, Frequency.MONTHLY, D0, null, Method.ANNUITY,
                null, 0, null, Convention.FOLLOWING, RoundingMode.HALF_UP)).isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new ScheduleRequest(thb(1000), BigDecimal.ONE, 1, Frequency.MONTHLY, D0, null, Method.ANNUITY,
                null, 0, CAL, null, RoundingMode.HALF_UP)).isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new ScheduleRequest(thb(1000), BigDecimal.ONE, 1, Frequency.MONTHLY, D0, null, Method.ANNUITY,
                null, 0, CAL, Convention.FOLLOWING, null)).isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> req(1000, "0.1", 1201, Method.ANNUITY, 0, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> req(1000, "0.1", 12, Method.ANNUITY, -1, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> req(1000, "0.1", 12, Method.ANNUITY, 0, -1)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void irregularFirstPeriodIsChargedForItsActualDays() {
        // disbursed 15 Jan, first due 1 Mar: 45 days, not a full month
        ScheduleRequest q = new ScheduleRequest(thb(12_000_000), new BigDecimal("0.12"), 12, Frequency.MONTHLY, D0,
                LocalDate.of(2026, 3, 2), Method.ANNUITY, null, 0, CAL, Convention.FOLLOWING, RoundingMode.HALF_UP);
        Schedule s = ScheduleEngine.build(q);
        long actual = Math.round(12_000_000 * 0.12 * 46 / 365.0);   // 15 Jan -> 2 Mar is 46 days
        assertThat(s.installments().get(0).interest().minor()).isEqualTo(actual);
        assertThat(s.installments().get(0).interest().minor()).isNotEqualTo(120_000);   // not a flat month of 1%
        assertInvariants(s, 12_000_000);
        // a regular first period is unchanged
        ScheduleRequest regular = new ScheduleRequest(thb(12_000_000), new BigDecimal("0.12"), 12, Frequency.MONTHLY, D0,
                LocalDate.of(2026, 2, 15), Method.ANNUITY, null, 0, BusinessCalendar.monToFri(Set.of()), Convention.PRECEDING,
                RoundingMode.HALF_UP);
        assertThat(ScheduleEngine.build(regular).installments().get(0).interest().minor()).isEqualTo(120_000);
        for (Method m : new Method[] {Method.EQUAL_PRINCIPAL, Method.BULLET}) {
            ScheduleRequest odd = new ScheduleRequest(thb(12_000_000), new BigDecimal("0.12"), 6, Frequency.MONTHLY, D0,
                    LocalDate.of(2026, 3, 2), m, null, 0, CAL, Convention.FOLLOWING, RoundingMode.HALF_UP);
            assertThat(ScheduleEngine.build(odd).installments().get(0).interest().minor()).isEqualTo(actual);
        }
    }
}
