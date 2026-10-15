package org.fabor.lending;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * A dealer's floor plan line: a revolving facility that funds stock vehicle by vehicle. Amounts are minor units. Terms
 * are per unit type: a sub-limit and the interest-free days the manufacturer bears. Curtailments are the share of a
 * unit's original principal that must have been repaid once the unit reaches an age; the dealer must repay a sold unit
 * within {@code payoffWindowDays}. {@code settlementAccountId} is the dealer's deposit account that repayments are taken
 * from (and where retail financing of a sold unit pays out).
 */
public record FloorPlanLine(String id, String dealerId, String currency, long limit, BigDecimal annualRate, int payoffWindowDays,
                            String settlementAccountId, Map<UnitType, UnitTerms> terms, List<Step> curtailments, Status status,
                            LocalDate signedOn) {
    public enum UnitType { NEW, USED, DEMO }

    public enum Status { ACTIVE, FROZEN, CLOSED }

    public record UnitTerms(long subLimit, int interestFreeDays) {
        public UnitTerms {
            if (subLimit <= 0 || interestFreeDays < 0) {
                throw new IllegalArgumentException("A unit type needs a positive sub-limit and non-negative interest-free days");
            }
        }
    }

    /** From {@code atDay} days after the draw, {@code cumulativePercent} of the original principal must be repaid. */
    public record Step(int atDay, int cumulativePercent) {
        public Step {
            if (atDay < 1 || cumulativePercent < 1 || cumulativePercent > 100) {
                throw new IllegalArgumentException("A curtailment step is at day 1 or later and 1 to 100 percent");
            }
        }
    }

    public FloorPlanLine {
        if (limit <= 0 || annualRate == null || annualRate.signum() < 0 || annualRate.compareTo(BigDecimal.ONE) > 0
                || payoffWindowDays < 0 || terms == null || terms.isEmpty() || curtailments == null) {
            throw new IllegalArgumentException("Invalid floor plan line");
        }
        for (UnitTerms t : terms.values()) {
            if (t.subLimit() > limit) {
                throw new IllegalArgumentException("A sub-limit cannot exceed the line limit");
            }
        }
        for (int i = 1; i < curtailments.size(); i++) {
            if (curtailments.get(i).atDay() <= curtailments.get(i - 1).atDay()
                    || curtailments.get(i).cumulativePercent() <= curtailments.get(i - 1).cumulativePercent()) {
                throw new IllegalArgumentException("Curtailment steps must increase in age and in percent");
            }
        }
        terms = Map.copyOf(terms);
        curtailments = List.copyOf(curtailments);
    }

    /** The share of the original principal that must be repaid by a unit {@code ageDays} old. */
    public int requiredPercent(long ageDays) {
        int pct = 0;
        for (Step s : curtailments) {
            if (ageDays >= s.atDay()) {
                pct = s.cumulativePercent();
            }
        }
        return pct;
    }

    public FloorPlanLine withStatus(Status s) {
        return new FloorPlanLine(id, dealerId, currency, limit, annualRate, payoffWindowDays, settlementAccountId, terms,
                curtailments, s, signedOn);
    }
}
