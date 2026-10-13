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
}
