package org.fabor.simulator;

import java.math.BigDecimal;

/** All amounts are minor units. {@code effectiveRate} is rounded to 6 places so golden files are stable. */
public record ScenarioResult(String scenario, int instalments, long interest, long upfrontFees, long lateCharges,
                             long settlementFee, long totalPaidByCustomer, BigDecimal effectiveRate, long finalBalance) { }
