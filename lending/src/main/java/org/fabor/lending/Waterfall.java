package org.fabor.lending;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Allocates a payment to what is due, oldest instalment first and, within an instalment, in the product's
 * waterfall order. Pure and exact: allocated amounts always sum to the amount applied.
 */
public final class Waterfall {
    public enum Component {
        FEES, PENALTY, VAT, INTEREST, PRINCIPAL;

        public static Component fromName(String waterfallName) {
            return switch (waterfallName) {
                case "FEES_DUE" -> FEES;
                case "PENALTY_DUE" -> PENALTY;
                case "VAT_DUE" -> VAT;
                case "INTEREST_DUE" -> INTEREST;
                case "PRINCIPAL_DUE" -> PRINCIPAL;
                default -> throw new IllegalArgumentException("Unknown waterfall component " + waterfallName);
            };
        }
    }

    public record Due(int instalment, Component component, long amount) { }

    public record Allocation(int instalment, Component component, long amount) { }

    public record Result(List<Allocation> allocations, long unallocated) {
        public long total(Component c) {
            return allocations.stream().filter(a -> a.component() == c).mapToLong(Allocation::amount).sum();
        }
    }

    private Waterfall() { }

    public static Result allocate(long payment, List<Due> dues, List<Component> order) {
        if (payment < 0) {
            throw new IllegalArgumentException("payment must not be negative");
        }
        Map<Component, Integer> rank = new EnumMap<>(Component.class);
        for (int i = 0; i < order.size(); i++) {
            rank.put(order.get(i), i);
        }
        List<Due> sorted = new ArrayList<>(dues.stream().filter(d -> d.amount() > 0 && rank.containsKey(d.component())).toList());
        sorted.sort(Comparator.comparingInt(Due::instalment).thenComparingInt(d -> rank.get(d.component())));
        List<Allocation> out = new ArrayList<>();
        long left = payment;
        for (Due d : sorted) {
            if (left == 0) {
                break;
            }
            long part = Math.min(left, d.amount());
            out.add(new Allocation(d.instalment(), d.component(), part));
            left -= part;
        }
        return new Result(List.copyOf(out), left);
    }
}
