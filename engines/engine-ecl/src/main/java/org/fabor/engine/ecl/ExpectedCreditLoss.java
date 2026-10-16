package org.fabor.engine.ecl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import org.fabor.platform.money.Money;

/**
 * TFRS 9 expected credit loss, version 1: three stages and an allowance of exposure x PD x LGD, discounted at the
 * effective interest rate. Pure and deterministic.
 *
 * <p>Stage 3 is a credit-impaired exposure (or one at or past the default threshold), stage 2 one with a significant
 * increase in credit risk (or past the 30-days presumption), stage 1 the rest. Stage 1 covers the next 12 months (or the
 * remaining life if shorter), stage 2 the remaining life, stage 3 is already in default (PD 1, no discounting). The annual
 * PD is turned into a horizon PD as {@code 1 - (1 - pd)^years}; the loss is discounted from the middle of the horizon.
 * PD and LGD are inputs from a model the bank owns and validates; no model is supplied here.
 */
public final class ExpectedCreditLoss {
    public enum Stage { STAGE_1, STAGE_2, STAGE_3 }

    /**
     * @param exposure         exposure at default: principal outstanding plus accrued interest
     * @param daysPastDue      days the oldest unpaid amount is overdue
     * @param creditImpaired   objective evidence of impairment, regardless of days past due
     * @param riskIncreased    significant increase in credit risk since origination, from the bank's own test
     * @param remainingMonths  months to contractual maturity
     * @param eirAnnual        effective interest rate per year used to discount
     */
    public record Exposure(Money exposure, int daysPastDue, boolean creditImpaired, boolean riskIncreased,
                           int remainingMonths, BigDecimal eirAnnual) {
        public Exposure {
            if (exposure.isNegative() || daysPastDue < 0 || remainingMonths < 1 || eirAnnual.signum() < 0) {
                throw new IllegalArgumentException("Invalid exposure");
            }
        }
    }

    /** @param annualPd twelve-month probability of default; {@code lgd} loss given default, both 0..1 */
    public record Parameters(BigDecimal annualPd, BigDecimal lgd, int stage2DaysPastDue, int stage3DaysPastDue) {
        public Parameters {
            if (annualPd.signum() < 0 || annualPd.compareTo(BigDecimal.ONE) > 0 || lgd.signum() < 0
                    || lgd.compareTo(BigDecimal.ONE) > 0 || stage2DaysPastDue < 1 || stage3DaysPastDue <= stage2DaysPastDue) {
                throw new IllegalArgumentException("Invalid ECL parameters");
            }
        }

        /** The usual thresholds: stage 2 at 30 days past due, stage 3 at 90. */
        public static Parameters of(String annualPd, String lgd) {
            return new Parameters(new BigDecimal(annualPd), new BigDecimal(lgd), 30, 90);
        }
    }

    public record Result(Stage stage, BigDecimal horizonPd, BigDecimal lgd, Money exposure, Money allowance) { }

    private ExpectedCreditLoss() { }

    public static Stage stage(Exposure e, Parameters p) {
        if (e.creditImpaired() || e.daysPastDue() >= p.stage3DaysPastDue()) {
            return Stage.STAGE_3;
        }
        if (e.riskIncreased() || e.daysPastDue() >= p.stage2DaysPastDue()) {
            return Stage.STAGE_2;
        }
        return Stage.STAGE_1;
    }

    public static Result compute(Exposure e, Parameters p) {
        Stage stage = stage(e, p);
        BigDecimal pd;
        BigDecimal factor = BigDecimal.ONE;
        if (stage == Stage.STAGE_3) {
            pd = BigDecimal.ONE;
        } else {
            int horizonMonths = stage == Stage.STAGE_1 ? Math.min(12, e.remainingMonths()) : e.remainingMonths();
            double years = horizonMonths / 12.0;
            pd = BigDecimal.valueOf(1 - StrictMath.pow(1 - p.annualPd().doubleValue(), years)).setScale(8, RoundingMode.HALF_UP);
            factor = BigDecimal.valueOf(StrictMath.pow(1 + e.eirAnnual().doubleValue(), -years / 2));
        }
        Money allowance = e.exposure().times(pd.multiply(p.lgd()).multiply(factor), RoundingMode.HALF_UP);
        return new Result(stage, pd, p.lgd(), e.exposure(), allowance);
    }

    /** Total allowance of a portfolio of results in one currency. */
    public static Money total(List<Result> results, Money zero) {
        return results.stream().map(Result::allowance).reduce(zero, Money::plus);
    }
}
