package org.fabor.engine.schedule;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.fabor.engine.interest.Eir;
import org.fabor.engine.interest.Rates;
import org.fabor.platform.money.Money;

/**
 * Builds repayment schedules. Pure and deterministic. Invariants, checked by property tests: principal
 * portions sum exactly to the principal, the closing balance is zero, every portion is non-negative, and
 * dates strictly increase. Rounding differences always land on the last instalment.
 *
 * <p>Interest per period is {@code opening x annualRate / periodsPerYear}; the first period is a full
 * period even if the first due date is irregular (odd-day interest is a later refinement).
 */
public final class ScheduleEngine {
    private ScheduleEngine() { }

    public static Schedule build(ScheduleRequest q) {
        List<Installment> list = switch (q.method()) {
            case ANNUITY -> annuity(q);
            case EQUAL_PRINCIPAL -> equalPrincipal(q);
            case BULLET -> bullet(q);
            case ANNUITY_FROM_FLAT -> annuityFromFlat(q);
        };
        long advanced = q.principal().minor();
        List<Long> pays = list.stream().map(i -> i.total().minor()).toList();
        long totalPay = pays.stream().mapToLong(Long::longValue).sum();
        BigDecimal eir = Eir.periodicRate(advanced, pays);
        return new Schedule(list, eir, Rates.effectiveAnnual(eir, q.frequency().perYear()),
                Money.ofMinor(totalPay - advanced, q.principal().currency()),
                Money.ofMinor(totalPay, q.principal().currency()));
    }

    private static LocalDate due(ScheduleRequest q, int number) {
        LocalDate anchor = q.firstDue() != null ? q.firstDue() : q.frequency().nth(q.disbursement(), 1);
        return q.calendar().adjust(q.frequency().nth(anchor, number - 1), q.convention());
    }

    private static BigDecimal periodicRate(ScheduleRequest q) {
        return Rates.periodic(q.annualRate(), q.frequency().perYear());
    }

    /**
     * Interest for period {@code n}. A regular period is opening x periodic rate. When the first due date is not one
     * regular period after disbursement, the first period is charged for its actual days (ACT/365 fixed) instead, so a
     * customer who pays first after 45 days is charged for 45 days.
     */
    private static Money interestFor(ScheduleRequest q, int n, Money open, BigDecimal r) {
        if (n == 1 && q.firstDue() != null && !q.firstDue().equals(q.frequency().nth(q.disbursement(), 1))) {
            long days = java.time.temporal.ChronoUnit.DAYS.between(q.disbursement(), q.firstDue());
            return open.times(q.annualRate().multiply(BigDecimal.valueOf(days), Rates.MC)
                    .divide(BigDecimal.valueOf(365), Rates.MC), q.rounding());
        }
        return open.times(r, q.rounding());
    }

    private static Installment row(ScheduleRequest q, int n, Money opening, Money principal, Money interest) {
        return new Installment(n, due(q, n), principal, interest, principal.plus(interest), opening.minus(principal));
    }

    private static List<Installment> annuity(ScheduleRequest q) {
        BigDecimal r = periodicRate(q);
        int io = q.interestOnlyPeriods();
        int m = q.periods() - io;
        Money payment = annuityPayment(q.principal(), q.balloon(), r, m, q);
        List<Installment> out = new ArrayList<>();
        Money open = q.principal();
        for (int n = 1; n <= q.periods(); n++) {
            Money interest = interestFor(q, n, open, r);
            Money principal;
            if (n <= io) {
                principal = Money.zero(open.currency());
            } else if (n == q.periods()) {
                principal = open; // clears the balance, including any balloon
            } else {
                principal = payment.minus(interest);
                if (principal.isNegative()) {
                    throw new IllegalArgumentException("Instalment does not cover interest in period " + n);
                }
                if (principal.compareTo(open) > 0) {
                    principal = open;
                }
            }
            Installment i = row(q, n, open, principal, interest);
            out.add(i);
            open = i.closingBalance();
        }
        return out;
    }

    private static Money annuityPayment(Money principal, Money balloon, BigDecimal r, int m, ScheduleRequest q) {
        BigDecimal p = BigDecimal.valueOf(principal.minor());
        BigDecimal b = BigDecimal.valueOf(balloon.minor());
        BigDecimal raw;
        if (r.signum() == 0) {
            raw = p.subtract(b).divide(BigDecimal.valueOf(m), Rates.MC);
        } else {
            BigDecimal growth = Rates.pow(BigDecimal.ONE.add(r), m);
            // payment = (P - B/(1+r)^m) * r / (1 - (1+r)^-m) = (P(1+r)^m - B) * r / ((1+r)^m - 1)
            raw = p.multiply(growth, Rates.MC).subtract(b).multiply(r, Rates.MC)
                    .divide(growth.subtract(BigDecimal.ONE), Rates.MC);
        }
        return Money.ofMinor(raw.setScale(0, q.rounding()).longValueExact(), principal.currency());
    }

    private static List<Installment> equalPrincipal(ScheduleRequest q) {
        BigDecimal r = periodicRate(q);
        int io = q.interestOnlyPeriods();
        int m = q.periods() - io;
        Money amortising = q.principal().minus(q.balloon());
        long[] weights = new long[m];
        java.util.Arrays.fill(weights, 1);
        Money[] parts = amortising.allocate(weights);
        List<Installment> out = new ArrayList<>();
        Money open = q.principal();
        for (int n = 1; n <= q.periods(); n++) {
            Money interest = interestFor(q, n, open, r);
            Money principal = n <= io ? Money.zero(open.currency()) : parts[n - io - 1];
            if (n == q.periods()) {
                principal = open;
            }
            Installment i = row(q, n, open, principal, interest);
            out.add(i);
            open = i.closingBalance();
        }
        return out;
    }

    private static List<Installment> bullet(ScheduleRequest q) {
        BigDecimal r = periodicRate(q);
        List<Installment> out = new ArrayList<>();
        Money open = q.principal();
        for (int n = 1; n <= q.periods(); n++) {
            Money interest = interestFor(q, n, open, r);
            Money principal = n == q.periods() ? open : Money.zero(open.currency());
            out.add(row(q, n, open, principal, interest));
        }
        return out;
    }

    /**
     * Quoted flat rate: total interest = principal x flat x years. Instalments are equal (the last absorbs
     * rounding), so the total payable is exact. The interest part of each instalment follows the implied EIR.
     */
    private static List<Installment> annuityFromFlat(ScheduleRequest q) {
        if (q.balloon().minor() != 0 || q.interestOnlyPeriods() != 0) {
            throw new IllegalArgumentException("ANNUITY_FROM_FLAT supports neither balloon nor interest-only periods");
        }
        int monthsPerPeriod = q.frequency().months();
        if (monthsPerPeriod < 0) {
            throw new IllegalArgumentException("Flat-rate quoting needs a monthly-or-longer frequency");
        }
        int months = q.periods() * monthsPerPeriod;
        Money flat = Rates.flatInterest(q.principal(), q.annualRate(), months, q.rounding());
        Money totalPayable = q.principal().plus(flat);
        Money instalment = Money.ofMinor(BigDecimal.valueOf(totalPayable.minor())
                .divide(BigDecimal.valueOf(q.periods()), Rates.MC).setScale(0, q.rounding()).longValueExact(),
                q.principal().currency());
        Money last = totalPayable.minus(instalment.times(BigDecimal.valueOf(q.periods() - 1), q.rounding()));
        List<Long> pays = new ArrayList<>();
        for (int n = 1; n <= q.periods(); n++) {
            pays.add(n == q.periods() ? last.minor() : instalment.minor());
        }
        BigDecimal r = Eir.periodicRate(q.principal().minor(), pays);
        List<Installment> out = new ArrayList<>();
        Money open = q.principal();
        for (int n = 1; n <= q.periods(); n++) {
            Money total = Money.ofMinor(pays.get(n - 1), q.principal().currency());
            Money interest = open.times(r, q.rounding());
            Money principal = total.minus(interest);
            if (n == q.periods()) {
                principal = open;
                interest = total.minus(principal);
                if (interest.isNegative()) {
                    throw new IllegalArgumentException("Flat rate too low for the term: rounding leaves negative interest");
                }
            } else if (principal.isNegative() || principal.compareTo(open) > 0) {
                throw new IllegalArgumentException("Flat rate too low for the term in period " + n);
            }
            out.add(row(q, n, open, principal, interest));
            open = open.minus(principal);
        }
        return out;
    }
}
