package org.fabor.platform.money;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.math.RoundingMode;
import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;
import org.junit.jupiter.api.Test;

class MoneyTest {

    @Test
    void parsesMajorUnitsExactly() {
        assertThat(Money.of(new BigDecimal("1234.56"), Currency.THB).minor()).isEqualTo(123_456);
        assertThat(Money.of(new BigDecimal("500"), Currency.JPY).minor()).isEqualTo(500);
    }

    @Test
    void rejectsExcessPrecision() {
        assertThatThrownBy(() -> Money.of(new BigDecimal("1.005"), Currency.THB))
                .isInstanceOf(ArithmeticException.class);
    }

    @Test
    void rejectsCurrencyMix() {
        assertThatThrownBy(() -> Money.ofMinor(1, Currency.THB).plus(Money.ofMinor(1, Currency.USD)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void overflowFailsLoudly() {
        assertThatThrownBy(() -> Money.ofMinor(Long.MAX_VALUE, Currency.THB).plus(Money.ofMinor(1, Currency.THB)))
                .isInstanceOf(ArithmeticException.class);
    }

    @Test
    void timesRoundsExplicitly() {
        Money m = Money.ofMinor(1005, Currency.THB);
        assertThat(m.times(new BigDecimal("0.5"), RoundingMode.HALF_EVEN).minor()).isEqualTo(502);
        assertThat(m.times(new BigDecimal("0.5"), RoundingMode.HALF_UP).minor()).isEqualTo(503);
    }

    @Test
    void allocateKeepsEveryMinorUnit() {
        Money[] parts = Money.ofMinor(100, Currency.THB).allocate(1, 1, 1);
        assertThat(parts).extracting(Money::minor).containsExactly(34L, 33L, 33L);
    }

    @Property
    void allocationAlwaysSumsToTotal(@ForAll("amounts") long minor, @ForAll("weights") long[] weights) {
        Money total = Money.ofMinor(minor, Currency.THB);
        Money sum = Money.zero(Currency.THB);
        for (Money part : total.allocate(weights)) {
            sum = sum.plus(part);
        }
        assertThat(sum).isEqualTo(total);
    }

    @Property
    void addThenSubtractIsIdentity(@ForAll("amounts") long a, @ForAll("amounts") long b) {
        Money x = Money.ofMinor(a, Currency.USD);
        Money y = Money.ofMinor(b, Currency.USD);
        assertThat(x.plus(y).minus(y)).isEqualTo(x);
    }

    @Provide
    Arbitrary<Long> amounts() {
        return Arbitraries.longs().between(-1_000_000_000_000L, 1_000_000_000_000L);
    }

    @Provide
    Arbitrary<long[]> weights() {
        return Arbitraries.longs().between(0, 1_000_000).array(long[].class).ofMinSize(1).ofMaxSize(12)
                .filter(w -> java.util.Arrays.stream(w).sum() > 0);
    }

    @Test
    void currencyValidation() {
        assertThatThrownBy(() -> new Currency("thb", 2)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Currency(null, 2)).isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new Currency("XXX", 5)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Currency("XXX", -1)).isInstanceOf(IllegalArgumentException.class);
        assertThat(Currency.EUR.minorUnits()).isEqualTo(2);
        assertThat(Currency.KWD.minorUnits()).isEqualTo(3);
    }

    @Test
    void allocateEdgeCases() {
        Money neg = Money.ofMinor(-100, Currency.THB);
        assertThat(neg.allocate(1, 1, 1)).extracting(Money::minor).containsExactly(-34L, -33L, -33L);
        assertThat(Money.ofMinor(5, Currency.THB).allocate(0, 1, 1)).extracting(Money::minor).containsExactly(0L, 3L, 2L);
        assertThat(Money.ofMinor(1, Currency.THB).allocate(1, 1, 1, 1)).extracting(Money::minor).containsExactly(1L, 0L, 0L, 0L);
        assertThatThrownBy(() -> neg.allocate()).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> neg.allocate(0, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> neg.allocate(-1, 2)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void helpers() {
        Money a = Money.ofMinor(150, Currency.THB);
        assertThat(a.negate().isNegative()).isTrue();
        assertThat(Money.zero(Currency.THB).isZero()).isTrue();
        assertThat(a.isZero()).isFalse();
        assertThat(a.isNegative()).isFalse();
        assertThat(a.toString()).isEqualTo("1.50 THB");
        assertThat(a.compareTo(Money.ofMinor(200, Currency.THB))).isNegative();
        assertThatThrownBy(() -> a.compareTo(Money.ofMinor(1, Currency.USD))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> a.times(BigDecimal.ONE, null)).isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new Money(1, null)).isInstanceOf(NullPointerException.class);
    }

    @Test
    void currencyLookup() {
        assertThat(Currency.of("THB")).isEqualTo(Currency.THB);
        assertThat(Currency.of("JPY").minorUnits()).isZero();
        assertThatThrownBy(() -> Currency.of("ZZZ")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Currency.of(null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Currency.of("XAU")).isInstanceOf(IllegalArgumentException.class);
    }
}
