package org.fabor.simulator;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.fabor.engine.product.Cel;
import org.fabor.engine.product.ProductDefinition;
import org.fabor.engine.product.ProductQuote;
import org.fabor.engine.product.ProductValidator;
import org.fabor.engine.schedule.Installment;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.time.BusinessCalendar;

/** Deterministic what-if runs over a product version. No clock: every date comes from the inputs. */
public final class ProductSimulator {
    private ProductSimulator() { }

    /** The standard scenario set every product is judged by. */
    public static List<Scenario> standardScenarios(int term) {
        List<Scenario> s = new ArrayList<>(List.of(Scenario.onTime(), Scenario.missed(1, 10), Scenario.missed(2, 45)));
        s.add(Scenario.earlySettlement(Math.max(1, term / 2)));
        return s;
    }

    public static List<ScenarioResult> run(ProductDefinition d, Money principal, int term, LocalDate disbursement,
                                           BusinessCalendar calendar, List<Scenario> scenarios) {
        var quote = ProductQuote.quote(d, principal, term, disbursement, calendar);
        List<ScenarioResult> out = new ArrayList<>();
        for (Scenario sc : scenarios) {
            out.add(run(d, principal, quote, sc));
        }
        return out;
    }

    private static ScenarioResult run(ProductDefinition d, Money principal, ProductQuote.Result quote, Scenario sc) {
        Currency cur = principal.currency();
        List<Installment> inst = quote.schedule().installments();
        long upfront = quote.disbursementFees().values().stream().mapToLong(Money::minor).sum();
        long interest = 0;
        long paid = 0;
        long late = 0;
        long settlementFee = 0;
        int n = inst.size();
        long balance = principal.minor();
        switch (sc.type()) {
            case ON_TIME -> {
                for (Installment i : inst) {
                    paid += i.total().minor();
                    interest += i.interest().minor();
                }
                balance = 0;
            }
            case MISSED -> {
                requireIndex(sc.at(), n);
                for (Installment i : inst) {
                    paid += i.total().minor();
                    interest += i.interest().minor();
                    if (i.number() == sc.at()) {
                        late = lateCharge(d, i.total().minor(), sc.days());
                    }
                }
                paid += late;
                balance = 0;
            }
            case EARLY_SETTLEMENT -> {
                requireIndex(sc.at(), n);
                for (Installment i : inst) {
                    if (i.number() <= sc.at()) {
                        paid += i.total().minor();
                        interest += i.interest().minor();
                    }
                }
                long remaining = inst.get(sc.at() - 1).closingBalance().minor();
                settlementFee = settlementFee(d, remaining, principal.minor(), n);
                paid += remaining + settlementFee;
                balance = 0;
            }
            default -> throw new IllegalStateException();
        }
        long totalPaid = paid + upfront;
        BigDecimal eff = effective(principal.minor() - upfront, inst, sc, balance, settlementFee, late);
        return new ScenarioResult(sc.name(), sc.type() == Scenario.Type.EARLY_SETTLEMENT ? sc.at() : n, interest,
                upfront, late, settlementFee, totalPaid, eff, balance);
    }

    private static void requireIndex(int at, int n) {
        if (at < 1 || at > n) {
            throw new IllegalArgumentException("Scenario instalment " + at + " is outside 1.." + n);
        }
    }

    private static long lateCharge(ProductDefinition d, long overdue, int days) {
        if (d.fees() == null) {
            return 0;
        }
        long total = 0;
        for (var f : d.fees()) {
            if ("DAILY_WHILE_OVERDUE".equals(f.trigger())) {
                long perDay = Cel.compile(f.amount(), ProductValidator.FEE_VARIABLES).evaluate(Map.of(
                        "principal", 0L, "term", 0L, "overdue", overdue, "outstanding", 0L));
                total += perDay * days;
            }
        }
        return total;
    }

    private static long settlementFee(ProductDefinition d, long outstanding, long principal, int term) {
        if (d.fees() == null) {
            return 0;
        }
        long total = 0;
        for (var f : d.fees()) {
            if ("EARLY_SETTLEMENT".equals(f.trigger())) {
                total += Cel.compile(f.amount(), ProductValidator.FEE_VARIABLES).evaluate(Map.of(
                        "principal", principal, "term", (long) term, "overdue", 0L, "outstanding", outstanding));
            }
        }
        return total;
    }

    /** Effective annual rate of what the customer really paid, from the net amount received. */
    private static BigDecimal effective(long net, List<Installment> inst, Scenario sc, long balance, long settlementFee,
                                        long late) {
        List<Long> pays = new ArrayList<>();
        for (Installment i : inst) {
            if (sc.type() == Scenario.Type.EARLY_SETTLEMENT && i.number() > sc.at()) {
                break;
            }
            long p = i.total().minor();
            if (sc.type() == Scenario.Type.MISSED && i.number() == sc.at()) {
                p += late;
            }
            if (sc.type() == Scenario.Type.EARLY_SETTLEMENT && i.number() == sc.at()) {
                p += i.closingBalance().minor() + settlementFee;
            }
            pays.add(p);
        }
        BigDecimal r = org.fabor.engine.interest.Eir.periodicRate(net, pays);
        return org.fabor.engine.interest.Rates.effectiveAnnual(r, 12).setScale(6, RoundingMode.HALF_UP);
    }

    /** Days between two dates, exposed for tests of late-charge periods. */
    static long days(LocalDate a, LocalDate b) {
        return ChronoUnit.DAYS.between(a, b);
    }
}
