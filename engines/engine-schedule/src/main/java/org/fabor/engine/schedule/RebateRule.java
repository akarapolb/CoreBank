package org.fabor.engine.schedule;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import org.fabor.platform.money.Money;

/**
 * How much of the interest not yet due a customer is excused when settling early. Written in a product as
 * {@code early_settlement.rebate}:
 * <ul>
 *   <li>{@code ACTUARIAL}: all interest not yet earned on the effective-rate schedule is excused, so the customer
 *       pays the remaining principal only. {@code EIR} and {@code NONE} (used by earlier product definitions, where
 *       no separate rebate was configured) mean the same.</li>
 *   <li>{@code RULE_OF_78}: the unearned part of the total interest is {@code s(s+1) / (n(n+1))}, where {@code s} is
 *       the number of instalments left and {@code n} the original number. It front-loads interest, so the rebate is
 *       never more than the actuarial one; it is capped at the interest actually still unbilled.</li>
 *   <li>{@code PERCENT:x}: a fixed fraction {@code x} (0..1) of the interest not yet due.</li>
 *   <li>{@code TIERED:a,b,c}: fractions of the interest not yet due that depend on how much of the term has been
 *       paid: {@code a} up to one third of the instalments, {@code b} up to two thirds, {@code c} beyond.</li>
 * </ul>
 * Pure arithmetic in minor units; rounding favours the customer on the rebate (half-up on the rebate itself).
 */
public final class RebateRule {
    public enum Kind { ACTUARIAL, RULE_OF_78, PERCENT, TIERED }

    private final Kind kind;
    private final List<BigDecimal> fractions;

    private RebateRule(Kind kind, List<BigDecimal> fractions) {
        this.kind = kind;
        this.fractions = List.copyOf(fractions);
    }

    public static RebateRule parse(String text) {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("Rebate rule is empty");
        }
        String t = text.trim();
        if (t.equals("ACTUARIAL") || t.equals("EIR") || t.equals("NONE")) {
            return new RebateRule(Kind.ACTUARIAL, List.of());
        }
        if (t.equals("RULE_OF_78")) {
            return new RebateRule(Kind.RULE_OF_78, List.of());
        }
        if (t.startsWith("PERCENT:")) {
            return new RebateRule(Kind.PERCENT, List.of(fraction(t.substring("PERCENT:".length()), text)));
        }
        if (t.startsWith("TIERED:")) {
            String[] parts = t.substring("TIERED:".length()).split(",", -1);
            if (parts.length != 3) {
                throw new IllegalArgumentException("TIERED needs three fractions: " + text);
            }
            List<BigDecimal> f = List.of(fraction(parts[0], text), fraction(parts[1], text), fraction(parts[2], text));
            return new RebateRule(Kind.TIERED, f);
        }
        throw new IllegalArgumentException("Unknown rebate rule '" + text
                + "'; use ACTUARIAL (or EIR, NONE), RULE_OF_78, PERCENT:x or TIERED:a,b,c");
    }

    private static BigDecimal fraction(String s, String whole) {
        BigDecimal v;
        try {
            v = new BigDecimal(s.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Not a number in rebate rule '" + whole + "'");
        }
        if (v.signum() < 0 || v.compareTo(BigDecimal.ONE) > 0) {
            throw new IllegalArgumentException("Rebate fractions must be between 0 and 1: " + whole);
        }
        return v;
    }

    public Kind kind() {
        return kind;
    }

    /**
     * The fraction of the interest not yet due that this rule excuses when {@code remaining} of {@code total}
     * instalments are left. For RULE_OF_78 this is relative to the total finance charge, so it needs the totals: use
     * {@link #rebate} instead; this method answers only the progress-based rules and ACTUARIAL (1).
     */
    public BigDecimal fractionAt(int total, int remaining) {
        return switch (kind) {
            case ACTUARIAL -> BigDecimal.ONE;
            case PERCENT -> fractions.get(0);
            case TIERED -> {
                int paid = total - remaining;
                // paid <= total/3 (integer-safe: 3*paid <= total), <= 2/3, else the last tier
                yield 3L * paid <= total ? fractions.get(0) : 3L * paid <= 2L * total ? fractions.get(1) : fractions.get(2);
            }
            case RULE_OF_78 -> throw new IllegalStateException("RULE_OF_78 is not a fraction of the remaining interest");
        };
    }

    /**
     * Rebate on early settlement.
     *
     * @param schedule   the original schedule
     * @param billed     number of instalments already billed (their interest is earned and owed in full)
     * @return the interest excused, between zero and the interest of the unbilled instalments
     */
    public Money rebate(Schedule schedule, int billed) {
        List<Installment> all = schedule.installments();
        int n = all.size();
        if (billed < 0 || billed > n) {
            throw new IllegalArgumentException("billed must be 0.." + n);
        }
        Money zero = Money.zero(schedule.totalInterest().currency());
        Money unbilledInterest = all.subList(billed, n).stream().map(Installment::interest).reduce(zero, Money::plus);
        int remaining = n - billed;
        if (remaining == 0 || unbilledInterest.isZero()) {
            return zero;
        }
        Money rebate;
        if (kind == Kind.RULE_OF_78) {
            BigDecimal share = BigDecimal.valueOf((long) remaining * (remaining + 1))
                    .divide(BigDecimal.valueOf((long) n * (n + 1)), java.math.MathContext.DECIMAL128);
            rebate = schedule.totalInterest().times(share, RoundingMode.HALF_UP);
        } else {
            rebate = unbilledInterest.times(fractionAt(n, remaining), RoundingMode.HALF_UP);
        }
        return rebate.compareTo(unbilledInterest) > 0 ? unbilledInterest : rebate;
    }
}
