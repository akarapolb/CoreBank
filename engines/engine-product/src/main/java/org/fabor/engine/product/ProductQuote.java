package org.fabor.engine.product;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import org.fabor.engine.schedule.Frequency;
import org.fabor.engine.schedule.Method;
import org.fabor.engine.schedule.Schedule;
import org.fabor.engine.schedule.ScheduleEngine;
import org.fabor.engine.schedule.ScheduleRequest;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.time.BusinessCalendar;
import org.fabor.platform.time.BusinessCalendar.Convention;

/**
 * Turns a validated product plus a customer request into a schedule, up-front fees and the disclosed
 * effective rate. Pure: the same product version and request always give the same quote.
 */
public final class ProductQuote {
    public record Result(Schedule schedule, Map<String, Money> disbursementFees, BigDecimal disclosedEffectiveRate) { }

    private ProductQuote() { }

    public static Result quote(ProductDefinition d, Money principal, int periods, LocalDate disbursement,
                               BusinessCalendar calendar) {
        if (!ProductValidator.ok(ProductValidator.validate(d))) {
            throw new IllegalArgumentException("Product " + d.product() + " v" + d.version() + " is not valid");
        }
        checkParameter(d, "principal", BigDecimal.valueOf(principal.minor(), principal.currency().minorUnits()));
        checkParameter(d, "term_months", BigDecimal.valueOf(periods));
        Currency cur = Currency.of(d.currency());
        if (!cur.equals(principal.currency())) {
            throw new IllegalArgumentException("Principal currency " + principal.currency().code() + " does not match product "
                    + d.currency());
        }
        if (d.pricing().rate() == null) {
            throw new IllegalArgumentException("Rate tables are resolved by the pricing service; supply a fixed rate here");
        }
        Convention conv = d.schedule().holidayRule() == null ? Convention.FOLLOWING
                : Convention.valueOf(d.schedule().holidayRule());
        Schedule s = ScheduleEngine.build(new ScheduleRequest(principal, d.pricing().rate(), periods,
                Frequency.valueOf(d.schedule().frequency()), disbursement, null, Method.valueOf(d.schedule().method()),
                null, 0, calendar, conv, RoundingMode.HALF_UP));
        Map<String, Money> fees = new LinkedHashMap<>();
        if (d.fees() != null) {
            for (var f : d.fees()) {
                if ("DISBURSEMENT".equals(f.trigger())) {
                    long minor = Cel.compile(f.amount(), ProductValidator.FEE_VARIABLES).evaluate(Map.of(
                            "principal", principal.minor(), "term", (long) periods, "overdue", 0L, "outstanding",
                            principal.minor()));
                    fees.put(f.code(), Money.ofMinor(minor, cur));
                }
            }
        }
        return new Result(s, fees, s.effectiveAnnualRate());
    }

    private static void checkParameter(ProductDefinition d, String name, BigDecimal value) {
        if (d.parameters() == null || d.parameters().get(name) == null) {
            return;
        }
        if (!ProductValidator.permits(d.parameters().get(name), value)) {
            throw new IllegalArgumentException("Parameter " + name + " = " + value.toPlainString()
                    + " is outside what product " + d.product() + " allows");
        }
    }
}
