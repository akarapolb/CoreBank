package org.fabor.app;

import java.math.BigDecimal;
import java.util.Optional;
import org.fabor.engine.ecl.ExpectedCreditLoss;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings of the loss-allowance run under {@code fabor.ecl.*}. The probability of default and the loss given default
 * come from the bank's own model and are deliberately not defaulted here: until both are set the run cannot be started,
 * by the schedule or by an operator. The schedule is off unless {@code enabled} is true.
 *
 * @param enabled             run daily on the cron schedule
 * @param cron                when the daily run starts (default 01:30)
 * @param annualPd            twelve-month probability of default, 0..1
 * @param lgd                 loss given default, 0..1
 * @param stage2DaysPastDue   days past due that move a loan to stage 2 (default 30)
 * @param stage3DaysPastDue   days past due that move a loan to stage 3 (default 90)
 */
@ConfigurationProperties(prefix = "fabor.ecl")
public record EclProperties(boolean enabled, String cron, BigDecimal annualPd, BigDecimal lgd, Integer stage2DaysPastDue,
                            Integer stage3DaysPastDue) {
    public EclProperties {
        if (cron == null || cron.isBlank()) {
            cron = "0 30 1 * * *";
        }
        if (stage2DaysPastDue == null) {
            stage2DaysPastDue = 30;
        }
        if (stage3DaysPastDue == null) {
            stage3DaysPastDue = 90;
        }
    }

    /** The model parameters, or empty until both PD and LGD are configured. */
    public Optional<ExpectedCreditLoss.Parameters> parameters() {
        if (annualPd == null || lgd == null) {
            return Optional.empty();
        }
        return Optional.of(new ExpectedCreditLoss.Parameters(annualPd, lgd, stage2DaysPastDue, stage3DaysPastDue));
    }
}
