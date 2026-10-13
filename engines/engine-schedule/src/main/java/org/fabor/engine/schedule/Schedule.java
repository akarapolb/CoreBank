package org.fabor.engine.schedule;

import java.math.BigDecimal;
import java.util.List;
import org.fabor.platform.money.Money;

/**
 * @param periodicEir          the effective rate per period implied by the actual cash flows
 * @param effectiveAnnualRate  (1 + periodicEir)^periodsPerYear - 1, the disclosed effective rate
 */
public record Schedule(List<Installment> installments, BigDecimal periodicEir, BigDecimal effectiveAnnualRate,
                       Money totalInterest, Money totalPayable) { }
