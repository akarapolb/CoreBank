package org.fabor.decisioning;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Explainable retail credit decision: hard policy rules first, then a transparent points scorecard. Every outcome
 * carries reason codes (what helped, what hurt) so declines can be explained to the customer and the regulator.
 * Pure and deterministic. A trained model can replace the scorecard behind {@link #decide}'s inputs, but must keep
 * the reason-code contract and pass the model-risk checks (docs/06).
 */
public final class CreditDecision {
    public enum Outcome { APPROVE, REFER, DECLINE }

    public record Applicant(int age, long monthlyIncome, long existingMonthlyDebt, Integer bureauScore,
                            int delinquencies12m, int monthsAtEmployer) { }

    public record Request(long amount, int termMonths, long monthlyInstalment) { }

    public record Policy(int minAge, int maxAgeAtMaturity, double maxDebtToIncome, int minBureauScore,
                         int maxDelinquencies12m, int approveScore, int referScore) {
        public static Policy retailV1() {
            return new Policy(20, 65, 0.50, 450, 1, 560, 500);
        }
    }

    public record Reason(String code, String text, int points) { }

    public record Result(Outcome outcome, int score, long approvedAmount, List<Reason> reasons) { }

    private CreditDecision() { }

    public static Result decide(Applicant a, Request r, Policy p) {
        List<Reason> declines = new ArrayList<>();
        if (a.age() < p.minAge()) {
            declines.add(new Reason("AGE_BELOW_MINIMUM", "Applicant is younger than " + p.minAge(), 0));
        }
        if (a.age() + (r.termMonths() + 11) / 12 > p.maxAgeAtMaturity()) {
            declines.add(new Reason("AGE_AT_MATURITY", "Loan would end after age " + p.maxAgeAtMaturity(), 0));
        }
        if (a.monthlyIncome() <= 0) {
            declines.add(new Reason("NO_VERIFIED_INCOME", "No verified income", 0));
        }
        if (a.bureauScore() != null && a.bureauScore() < p.minBureauScore()) {
            declines.add(new Reason("BUREAU_SCORE_TOO_LOW", "Credit bureau score is below the minimum", 0));
        }
        if (a.delinquencies12m() > p.maxDelinquencies12m()) {
            declines.add(new Reason("RECENT_DELINQUENCIES", "Too many late payments in the last 12 months", 0));
        }
        double dti = a.monthlyIncome() <= 0 ? Double.MAX_VALUE
                : (double) (a.existingMonthlyDebt() + r.monthlyInstalment()) / a.monthlyIncome();
        if (dti > p.maxDebtToIncome() + 0.20) {
            declines.add(new Reason("DEBT_TO_INCOME_TOO_HIGH", "Debt payments would exceed the allowed share of income", 0));
        }
        if (!declines.isEmpty()) {
            return new Result(Outcome.DECLINE, 0, 0, List.copyOf(declines));
        }

        List<Reason> factors = new ArrayList<>();
        int score = 500;
        score += add(factors, bureauPoints(a.bureauScore()), "BUREAU", a.bureauScore() == null ? "No bureau history" : "Credit bureau score");
        score += add(factors, a.delinquencies12m() == 0 ? 25 : -40, "DELINQUENCY", a.delinquencies12m() == 0
                ? "No late payments in 12 months" : "A late payment in the last 12 months");
        score += add(factors, dti <= 0.30 ? 40 : dti <= p.maxDebtToIncome() ? 0 : -45, "DEBT_TO_INCOME",
                dti <= 0.30 ? "Low debt burden" : dti <= p.maxDebtToIncome() ? "Moderate debt burden" : "High debt burden");
        score += add(factors, a.monthsAtEmployer() >= 24 ? 25 : a.monthsAtEmployer() >= 6 ? 5 : -25, "STABILITY",
                a.monthsAtEmployer() >= 24 ? "Stable employment" : a.monthsAtEmployer() >= 6 ? "Short employment" : "Very short employment");
        long capacity = Math.max(0, (long) (p.maxDebtToIncome() * a.monthlyIncome()) - a.existingMonthlyDebt());
        boolean affordable = r.monthlyInstalment() <= capacity;
        score += add(factors, affordable ? 0 : -30, "AFFORDABILITY", affordable ? "Instalment is affordable" : "Instalment exceeds capacity");

        Outcome outcome = score >= p.approveScore() && affordable ? Outcome.APPROVE
                : score >= p.referScore() ? Outcome.REFER : Outcome.DECLINE;
        long approved = outcome == Outcome.APPROVE ? r.amount() : 0;
        List<Reason> sorted = factors.stream().sorted(Comparator.comparingInt(Reason::points)).toList();
        return new Result(outcome, score, approved, outcome == Outcome.APPROVE ? sorted.reversed() : sorted);
    }

    private static int add(List<Reason> out, int points, String code, String text) {
        out.add(new Reason(code, text, points));
        return points;
    }

    private static int bureauPoints(Integer s) {
        if (s == null) {
            return -10;
        }
        return s >= 750 ? 70 : s >= 680 ? 40 : s >= 600 ? 15 : s >= 520 ? -15 : -40;
    }
}
