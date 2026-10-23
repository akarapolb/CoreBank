package org.fabor.lending;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;
import org.fabor.engine.ecl.ExpectedCreditLoss;

/**
 * The periodic loss-allowance run: assesses and books every loan, active or not, so a loan that has just closed or been
 * written off has its allowance released. One loan failing does not stop the others; its id and the reason are reported.
 * Each loan is booked once per day (see {@link EclService#book}), so running twice on a day changes nothing.
 *
 * <p>The run reads every loan id, closed ones included, which is fine for a first version and the first thing to narrow
 * (to loans holding an allowance) when the loan book is large.
 */
public final class EclRun {
    /**
     * @param assessed   loans with an exposure, assessed and booked
     * @param inactive   loans with no exposure (closed or written off): any allowance they held is released
     * @param failures   loan id and reason for each loan that could not be booked
     */
    public record Summary(LocalDate asOf, int assessed, int stage1, int stage2, int stage3, int inactive,
                          Map<String, Long> allowanceByCurrency, List<String> failures) { }

    private final LoanRepo loans;
    private final EclService ecl;

    public EclRun(LoanRepo loans, EclService ecl) {
        this.loans = loans;
        this.ecl = ecl;
    }

    /**
     * @param riskIncreased the bank's own significant-increase-in-credit-risk test, by loan id
     */
    public Summary run(LocalDate asOf, ExpectedCreditLoss.Parameters params, Predicate<String> riskIncreased) {
        int assessed = 0;
        int s1 = 0;
        int s2 = 0;
        int s3 = 0;
        int inactive = 0;
        Map<String, Long> byCurrency = new LinkedHashMap<>();
        List<String> failures = new ArrayList<>();
        for (String id : loans.allIds()) {
            try {
                ExpectedCreditLoss.Result r = ecl.book(id, asOf, riskIncreased.test(id), params);
                if (r.exposure().isZero()) {
                    inactive++;
                    continue;
                }
                assessed++;
                switch (r.stage()) {
                    case STAGE_1 -> s1++;
                    case STAGE_2 -> s2++;
                    case STAGE_3 -> s3++;
                }
                byCurrency.merge(r.allowance().currency().code(), r.allowance().minor(), Long::sum);
            } catch (RuntimeException e) {
                failures.add(id + ": " + e.getMessage());
            }
        }
        return new Summary(asOf, assessed, s1, s2, s3, inactive, Map.copyOf(byCurrency), List.copyOf(failures));
    }
}
