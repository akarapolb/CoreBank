package org.fabor.engine.lease;

import java.util.ArrayList;
import java.util.List;
import org.fabor.platform.money.Money;

/**
 * Lessor accounting for an operating lease: the asset stays on the lessor's books and is depreciated straight-line to
 * its residual value over the lease; rental income is recognised straight-line over the term whatever the billing
 * pattern. The difference between billed and recognised rent is the accrued (or deferred) rent balance.
 */
public final class OperatingLease {
    public record Row(int period, Money billedRent, Money recognisedRent, Money accruedRent, Money depreciation,
                      Money netBookValue) { }

    public record Result(List<Row> rows, Money totalRent, Money totalDepreciation) { }

    private OperatingLease() { }

    /** @param billed rent invoiced in each period (length = periods), possibly stepped or with free months */
    public static Result schedule(Money assetCost, Money residual, List<Money> billed) {
        int n = billed.size();
        if (n < 1) {
            throw new IllegalArgumentException("A lease needs at least one period");
        }
        if (residual.compareTo(assetCost) > 0) {
            throw new IllegalArgumentException("Residual value cannot exceed cost");
        }
        Money totalRent = billed.stream().reduce(Money.zero(assetCost.currency()), Money::plus);
        long[] ones = new long[n];
        java.util.Arrays.fill(ones, 1);
        Money[] rent = totalRent.allocate(ones);
        Money[] dep = assetCost.minus(residual).allocate(ones);
        List<Row> rows = new ArrayList<>();
        Money accrued = Money.zero(assetCost.currency());
        Money nbv = assetCost;
        for (int i = 0; i < n; i++) {
            accrued = accrued.plus(rent[i]).minus(billed.get(i));
            nbv = nbv.minus(dep[i]);
            rows.add(new Row(i + 1, billed.get(i), rent[i], accrued, dep[i], nbv));
        }
        return new Result(List.copyOf(rows), totalRent, assetCost.minus(residual));
    }
}
