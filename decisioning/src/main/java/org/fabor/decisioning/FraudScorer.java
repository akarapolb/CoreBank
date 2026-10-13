package org.fabor.decisioning;

import java.util.ArrayList;
import java.util.List;

/**
 * Real-time transaction risk on the posting path: a handful of explainable rules, microseconds to evaluate
 * (budget 30 ms). A learned model can add its own points behind the same {@link Result} contract.
 */
public final class FraudScorer {
    public enum Action { ALLOW, STEP_UP, HOLD, BLOCK }

    public record Tx(long amount, int accountAgeDays, boolean newDevice, boolean newPayee, int txCountLastHour,
                     long outflowLast24h, long typicalOutflow24h, int hourOfDay, boolean sanctionsPossibleMatch) { }

    public record Signal(String code, int points) { }

    public record Result(int score, Action action, List<Signal> signals) { }

    private FraudScorer() { }

    public static Result score(Tx t) {
        List<Signal> s = new ArrayList<>();
        if (t.sanctionsPossibleMatch()) {
            s.add(new Signal("SANCTIONS_POSSIBLE_MATCH", 80));
        }
        if (t.newDevice() && t.newPayee()) {
            s.add(new Signal("NEW_DEVICE_AND_NEW_PAYEE", 35));
        } else if (t.newDevice()) {
            s.add(new Signal("NEW_DEVICE", 15));
        } else if (t.newPayee()) {
            s.add(new Signal("NEW_PAYEE", 10));
        }
        if (t.accountAgeDays() < 7) {
            s.add(new Signal("ACCOUNT_UNDER_7_DAYS", 20));
        }
        if (t.txCountLastHour() >= 10) {
            s.add(new Signal("VELOCITY_10_PER_HOUR", 30));
        } else if (t.txCountLastHour() >= 5) {
            s.add(new Signal("VELOCITY_5_PER_HOUR", 15));
        }
        long baseline = Math.max(1, t.typicalOutflow24h());
        long projected = t.outflowLast24h() + t.amount();
        if (projected > 10 * baseline) {
            s.add(new Signal("OUTFLOW_10X_TYPICAL", 40));
        } else if (projected > 4 * baseline) {
            s.add(new Signal("OUTFLOW_4X_TYPICAL", 20));
        }
        if (t.hourOfDay() < 5) {
            s.add(new Signal("UNUSUAL_HOUR", 10));
        }
        int score = Math.min(100, s.stream().mapToInt(Signal::points).sum());
        Action a = score >= 80 ? Action.BLOCK : score >= 60 ? Action.HOLD : score >= 30 ? Action.STEP_UP : Action.ALLOW;
        return new Result(score, a, List.copyOf(s));
    }
}
