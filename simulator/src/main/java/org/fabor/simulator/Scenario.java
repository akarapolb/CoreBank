package org.fabor.simulator;

/**
 * A named situation to run a product through.
 * <ul>
 *   <li>ON_TIME: every instalment paid on its due date</li>
 *   <li>MISSED: instalment {@code at} is paid {@code days} days late</li>
 *   <li>EARLY_SETTLEMENT: settled in full on the due date of instalment {@code at}</li>
 * </ul>
 */
public record Scenario(String name, Type type, int at, int days) {
    public enum Type { ON_TIME, MISSED, EARLY_SETTLEMENT }

    public static Scenario onTime() {
        return new Scenario("on_time", Type.ON_TIME, 0, 0);
    }

    public static Scenario missed(int instalment, int daysLate) {
        return new Scenario("missed_" + instalment + "_by_" + daysLate + "d", Type.MISSED, instalment, daysLate);
    }

    public static Scenario earlySettlement(int atInstalment) {
        return new Scenario("early_settlement_at_" + atInstalment, Type.EARLY_SETTLEMENT, atInstalment, 0);
    }
}
