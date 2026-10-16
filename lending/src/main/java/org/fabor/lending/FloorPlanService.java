package org.fabor.lending;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.fabor.ledger.application.LedgerService;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.ledger.domain.Direction;
import org.fabor.ledger.domain.Entry;
import org.fabor.ledger.domain.PostingBatch;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.IdempotencyKey;
import org.fabor.platform.tenancy.TenantId;

/**
 * Floor plan financing: a dealer's revolving line that funds stock one vehicle at a time.
 *
 * <p>A drawdown pays the distributor and is secured by the unit. Interest accrues daily on the unit's outstanding
 * principal; the days of the unit type's interest-free period are borne by the manufacturer (booked to a subvention
 * receivable, not to the dealer), the rest is the dealer's. Curtailments are the share of the original principal that must
 * be repaid as the unit ages. A sold unit must be repaid within the line's window; when the retail buyer is financed by
 * the bank, {@link #settleFromRetailLoan} checks the retail loan covers the payoff. Repayments take interest first, then
 * principal, from the dealer's settlement account. Every posting has a deterministic id, so each call can be retried.
 *
 * <p>Stock audits, sold-out-of-trust alerts, the manufacturer's payment of subvention and the dealer's risk grade are not
 * built yet.
 */
public final class FloorPlanService {
    public static final AccountId OEM_SUBVENTION_RECEIVABLE = new AccountId("gl:oem-subvention-receivable");
    private static final MathContext MC = MathContext.DECIMAL128;

    /** One unit on a dealer statement: interest owed and the principal due now (a curtailment, or all of it once sold). */
    public record StatementRow(String unitId, long interestDue, long principalDue, boolean saleOverdue) {
        public long total() {
            return interestDue + principalDue;
        }
    }

    public record Statement(String lineId, LocalDate asOf, List<StatementRow> rows, long total) { }

    private record Accrual(long dealer, long manufacturer) { }

    private final TenantId tenant;
    private final LedgerService ledger;
    private final FloorPlanRepo repo;
    private final LoanRepo loans;

    public FloorPlanService(TenantId tenant, LedgerService ledger, FloorPlanRepo repo, LoanRepo loans) {
        this.tenant = tenant;
        this.ledger = ledger;
        this.repo = repo;
        this.loans = loans;
    }

    public static AccountId principalAcct(String lineId, String unitId) {
        return new AccountId("fp:" + lineId + ":" + unitId + ":principal");
    }

    public static AccountId interestAcct(String lineId, String unitId) {
        return new AccountId("fp:" + lineId + ":" + unitId + ":interest");
    }

    public FloorPlanLine open(FloorPlanLine line) {
        if (repo.findLine(line.id()).isPresent()) {
            throw new IllegalStateException("Floor plan line already exists: " + line.id());
        }
        repo.saveLine(line);
        return line;
    }

    /** Stops new drawdowns, for example after a sold-out-of-trust finding. Repayments carry on. */
    public FloorPlanLine freeze(String lineId) {
        return setStatus(lineId, FloorPlanLine.Status.FROZEN);
    }

    public FloorPlanLine unfreeze(String lineId) {
        return setStatus(lineId, FloorPlanLine.Status.ACTIVE);
    }

    /** Funds a unit: pays {@code supplierAccountId} (the distributor) and books the principal. One drawdown per unit. */
    public FloorPlanUnit draw(String lineId, String unitId, FloorPlanLine.UnitType type, Money amount, LocalDate date,
                              String supplierAccountId) {
        FloorPlanLine line = line(lineId);
        if (line.status() != FloorPlanLine.Status.ACTIVE) {
            throw new IllegalStateException("Line " + lineId + " is " + line.status());
        }
        if (repo.findUnit(lineId, unitId).isPresent()) {
            throw new IllegalStateException("Unit " + unitId + " is already financed on line " + lineId);
        }
        if (!amount.currency().code().equals(line.currency()) || amount.minor() <= 0) {
            throw new IllegalArgumentException("A drawdown must be positive and in " + line.currency());
        }
        FloorPlanLine.UnitTerms terms = line.terms().get(type);
        if (terms == null) {
            throw new IllegalArgumentException("Line " + lineId + " does not finance " + type + " units");
        }
        long lineUsed = 0;
        long typeUsed = 0;
        for (FloorPlanUnit u : repo.units(lineId)) {
            lineUsed += u.principalOutstanding();
            typeUsed += u.type() == type ? u.principalOutstanding() : 0;
        }
        if (lineUsed + amount.minor() > line.limit()) {
            throw new IllegalStateException("The drawdown exceeds the line limit by " + (lineUsed + amount.minor() - line.limit()));
        }
        if (typeUsed + amount.minor() > terms.subLimit()) {
            throw new IllegalStateException("The drawdown exceeds the " + type + " sub-limit by "
                    + (typeUsed + amount.minor() - terms.subLimit()));
        }
        post(lineId, unitId, "draw", date, List.of(
                new Entry(principalAcct(lineId, unitId), BalanceType.SETTLED, Direction.DEBIT, amount),
                new Entry(new AccountId("dep:" + supplierAccountId), BalanceType.SETTLED, Direction.CREDIT, amount)));
        FloorPlanUnit unit = new FloorPlanUnit(lineId, unitId, type, amount.minor(), 0, date, date, 0, 0, 0, null,
                FloorPlanUnit.Status.OPEN);
        repo.saveUnit(unit);
        return unit;
    }

    /** Books the interest of the days up to {@code upTo}: the dealer's part to interest receivable, the manufacturer's to subvention. */
    public FloorPlanUnit accrue(String lineId, String unitId, LocalDate upTo) {
        FloorPlanLine line = line(lineId);
        FloorPlanUnit unit = unit(lineId, unitId);
        if (unit.status() == FloorPlanUnit.Status.PAID || !upTo.isAfter(unit.interestThrough())) {
            return unit;
        }
        Accrual a = accrual(line, unit, upTo);
        Currency cur = Currency.of(line.currency());
        List<Entry> entries = new ArrayList<>();
        if (a.dealer() > 0) {
            entries.add(new Entry(interestAcct(lineId, unitId), BalanceType.SETTLED, Direction.DEBIT, Money.ofMinor(a.dealer(), cur)));
            entries.add(new Entry(LoanService.INTEREST_INCOME, BalanceType.SETTLED, Direction.CREDIT, Money.ofMinor(a.dealer(), cur)));
        }
        if (a.manufacturer() > 0) {
            entries.add(new Entry(OEM_SUBVENTION_RECEIVABLE, BalanceType.SETTLED, Direction.DEBIT, Money.ofMinor(a.manufacturer(), cur)));
            entries.add(new Entry(LoanService.INTEREST_INCOME, BalanceType.SETTLED, Direction.CREDIT, Money.ofMinor(a.manufacturer(), cur)));
        }
        if (!entries.isEmpty()) {
            post(lineId, unitId, "accrue-" + upTo, upTo, entries);
        }
        FloorPlanUnit next = unit.withAccrual(upTo, a.dealer(), a.manufacturer());
        repo.saveUnit(next);
        return next;
    }

    /** The principal that must be repaid now: the curtailment for the unit's age, or all of it once the unit is sold. */
    public long principalDue(String lineId, String unitId, LocalDate date) {
        FloorPlanLine line = line(lineId);
        FloorPlanUnit unit = unit(lineId, unitId);
        if (unit.status() == FloorPlanUnit.Status.PAID) {
            return 0;
        }
        if (unit.soldOn() != null) {
            return unit.principalOutstanding();
        }
        int pct = line.requiredPercent(ChronoUnit.DAYS.between(unit.drawnOn(), date));
        long required = BigDecimal.valueOf(unit.drawn()).multiply(BigDecimal.valueOf(pct)).divide(BigDecimal.valueOf(100), MC)
                .setScale(0, RoundingMode.HALF_UP).longValueExact();
        return Math.max(0, required - unit.principalPaid());
    }

    /** What closes the unit on {@code date}: principal, interest owed and the dealer's interest of the days not yet booked. */
    public Money payoffAmount(String lineId, String unitId, LocalDate date) {
        FloorPlanLine line = line(lineId);
        FloorPlanUnit unit = unit(lineId, unitId);
        long total = unit.status() == FloorPlanUnit.Status.PAID ? 0
                : unit.principalOutstanding() + unit.interestOutstanding() + accrual(line, unit, date).dealer();
        return Money.ofMinor(total, Currency.of(line.currency()));
    }

    /** The dealer sold the unit on {@code soldOn}: the payoff window starts. Recording it again with the same date changes nothing. */
    public FloorPlanUnit recordSale(String lineId, String unitId, LocalDate soldOn) {
        FloorPlanUnit unit = unit(lineId, unitId);
        if (unit.status() == FloorPlanUnit.Status.PAID) {
            throw new IllegalStateException("Unit " + unitId + " is already paid");
        }
        if (unit.soldOn() != null) {
            if (unit.soldOn().equals(soldOn)) {
                return unit;
            }
            throw new IllegalStateException("Unit " + unitId + " was already recorded as sold on " + unit.soldOn());
        }
        if (soldOn.isBefore(unit.drawnOn())) {
            throw new IllegalArgumentException("A unit cannot be sold before it was drawn");
        }
        FloorPlanUnit sold = unit.withSale(soldOn);
        repo.saveUnit(sold);
        return sold;
    }

    /**
     * A payment from the dealer's settlement account: interest first, then principal. Accrues interest to the day first.
     * More than is owed is refused. Idempotent per reference.
     */
    public FloorPlanUnit repay(String lineId, String unitId, String reference, Money amount, LocalDate date) {
        FloorPlanLine line = line(lineId);
        if (ledger.find(tenant, new BatchId(lineId + ":" + unitId + ":pay-" + reference)).isPresent()) {
            return unit(lineId, unitId);
        }
        if (amount.minor() <= 0) {
            throw new IllegalArgumentException("Payment must be positive");
        }
        FloorPlanUnit unit = accrue(lineId, unitId, date);
        if (unit.status() == FloorPlanUnit.Status.PAID) {
            throw new IllegalStateException("Unit " + unitId + " is already paid");
        }
        long interest = Math.min(amount.minor(), unit.interestOutstanding());
        long principal = amount.minor() - interest;
        if (principal > unit.principalOutstanding()) {
            throw new IllegalArgumentException("Payment exceeds what is owed by " + (principal - unit.principalOutstanding()));
        }
        Currency cur = Currency.of(line.currency());
        List<Entry> entries = new ArrayList<>();
        entries.add(Entry.guardedDebit(new AccountId("dep:" + line.settlementAccountId()), BalanceType.SETTLED, amount));
        if (interest > 0) {
            entries.add(new Entry(interestAcct(lineId, unitId), BalanceType.SETTLED, Direction.CREDIT, Money.ofMinor(interest, cur)));
        }
        if (principal > 0) {
            entries.add(new Entry(principalAcct(lineId, unitId), BalanceType.SETTLED, Direction.CREDIT, Money.ofMinor(principal, cur)));
        }
        post(lineId, unitId, "pay-" + reference, date, entries);
        FloorPlanUnit next = unit.withPayment(interest, principal);
        repo.saveUnit(next);
        return next;
    }

    /** Pays the unit off in full on {@code date} (a sale, or the end of the unit's life on the line). */
    public FloorPlanUnit payoff(String lineId, String unitId, String reference, LocalDate date) {
        if (ledger.find(tenant, new BatchId(lineId + ":" + unitId + ":pay-" + reference)).isPresent()) {
            return unit(lineId, unitId);
        }
        accrue(lineId, unitId, date);
        return repay(lineId, unitId, reference, payoffAmount(lineId, unitId, date), date);
    }

    /**
     * Pays a sold unit off from the retail financing the bank gave its buyer: the retail loan must exist, be live and
     * be at least as large as the payoff. The retail loan is expected to have been paid out to the dealer's settlement
     * account, which then funds the payoff.
     */
    public FloorPlanUnit settleFromRetailLoan(String lineId, String unitId, String retailLoanId, String reference, LocalDate date) {
        Loan retail = loans.find(retailLoanId).orElseThrow(() -> new IllegalArgumentException("Unknown retail loan " + retailLoanId));
        if (retail.status() != Loan.Status.ACTIVE) {
            throw new IllegalStateException("Retail loan " + retailLoanId + " is " + retail.status());
        }
        if (retail.principal() < payoffAmount(lineId, unitId, date).minor()) {
            throw new IllegalStateException("Retail loan " + retailLoanId + " does not cover the payoff of unit " + unitId);
        }
        recordSale(lineId, unitId, date);
        return payoff(lineId, unitId, reference, date);
    }

    /** The dealer's monthly statement: for each open unit the interest owed and the principal due now. */
    public Statement statement(String lineId, LocalDate asOf) {
        FloorPlanLine line = line(lineId);
        List<StatementRow> rows = new ArrayList<>();
        for (FloorPlanUnit u : repo.units(lineId)) {
            if (u.status() == FloorPlanUnit.Status.OPEN) {
                long interest = u.interestOutstanding() + accrual(line, u, asOf).dealer();
                rows.add(new StatementRow(u.unitId(), interest, principalDue(lineId, u.unitId(), asOf), saleOverdue(line, u, asOf)));
            }
        }
        return new Statement(lineId, asOf, List.copyOf(rows), rows.stream().mapToLong(StatementRow::total).sum());
    }

    /** Units sold and not paid off within the line's window. */
    public List<FloorPlanUnit> overdueSales(String lineId, LocalDate asOf) {
        FloorPlanLine line = line(lineId);
        return repo.units(lineId).stream().filter(u -> saleOverdue(line, u, asOf)).toList();
    }

    /**
     * Result of a physical stock audit. {@code missing} are open, unsold units not found on the lot (a unit may have been
     * sold without being reported); {@code saleOverdue} are units reported sold and not paid off in the window;
     * {@code unexpected} are units found on the lot that the line does not know. Together the first two are the
     * sold-out-of-trust suspects.
     */
    public record StockAudit(String lineId, LocalDate asOf, List<String> missing, List<String> saleOverdue,
                             List<String> unexpected, int checked) {
        public List<String> soldOutOfTrust() {
            return java.util.stream.Stream.concat(missing.stream(), saleOverdue.stream()).sorted().toList();
        }

        public boolean clean() {
            return missing.isEmpty() && saleOverdue.isEmpty() && unexpected.isEmpty();
        }
    }

    /**
     * Compares the line's open stock with the unit ids an inspector found on the lot. Read-only: it books nothing, so an
     * audit can be repeated; acting on the findings (freezing the line, calling the dealer) is a separate decision.
     */
    public StockAudit stockAudit(String lineId, LocalDate asOf, java.util.Set<String> foundOnLot) {
        FloorPlanLine line = line(lineId);
        List<FloorPlanUnit> all = repo.units(lineId);
        java.util.Set<String> known = all.stream().map(FloorPlanUnit::unitId).collect(java.util.stream.Collectors.toSet());
        List<String> missing = new ArrayList<>();
        List<String> overdue = new ArrayList<>();
        int checked = 0;
        for (FloorPlanUnit u : all) {
            if (u.status() != FloorPlanUnit.Status.OPEN) {
                continue;
            }
            checked++;
            if (saleOverdue(line, u, asOf)) {
                overdue.add(u.unitId());
            } else if (u.soldOn() == null && !foundOnLot.contains(u.unitId())) {
                missing.add(u.unitId());
            }
        }
        List<String> unexpected = foundOnLot.stream().filter(id -> !known.contains(id)).sorted().toList();
        return new StockAudit(lineId, asOf, List.copyOf(missing), List.copyOf(overdue), unexpected, checked);
    }

    /** Principal outstanding across the line's units. */
    public Money exposure(String lineId) {
        FloorPlanLine line = line(lineId);
        return Money.ofMinor(repo.units(lineId).stream().mapToLong(FloorPlanUnit::principalOutstanding).sum(),
                Currency.of(line.currency()));
    }

    public Optional<FloorPlanUnit> findUnit(String lineId, String unitId) {
        return repo.findUnit(lineId, unitId);
    }

    public Optional<FloorPlanLine> findLine(String lineId) {
        return repo.findLine(lineId);
    }

    private boolean saleOverdue(FloorPlanLine line, FloorPlanUnit u, LocalDate asOf) {
        return u.status() == FloorPlanUnit.Status.OPEN && u.soldOn() != null
                && asOf.isAfter(u.soldOn().plusDays(line.payoffWindowDays()));
    }

    /** Interest of the days from the unit's interest-through date to {@code upTo}, split into dealer and manufacturer parts. */
    private Accrual accrual(FloorPlanLine line, FloorPlanUnit unit, LocalDate upTo) {
        if (!upTo.isAfter(unit.interestThrough())) {
            return new Accrual(0, 0);
        }
        long from = ChronoUnit.DAYS.between(unit.drawnOn(), unit.interestThrough());
        long to = ChronoUnit.DAYS.between(unit.drawnOn(), upTo);
        long freeEnd = line.terms().get(unit.type()).interestFreeDays();
        long freeDays = Math.max(0, Math.min(to, freeEnd) - from);
        long paidDays = (to - from) - freeDays;
        return new Accrual(interest(line, unit, paidDays), interest(line, unit, freeDays));
    }

    private long interest(FloorPlanLine line, FloorPlanUnit unit, long days) {
        BigDecimal factor = line.annualRate().multiply(BigDecimal.valueOf(days), MC).divide(BigDecimal.valueOf(365), MC);
        return BigDecimal.valueOf(unit.principalOutstanding()).multiply(factor, MC).setScale(0, RoundingMode.HALF_UP).longValueExact();
    }

    private FloorPlanLine setStatus(String lineId, FloorPlanLine.Status status) {
        FloorPlanLine line = line(lineId);
        if (line.status() == FloorPlanLine.Status.CLOSED) {
            throw new IllegalStateException("Line " + lineId + " is closed");
        }
        FloorPlanLine next = line.withStatus(status);
        repo.saveLine(next);
        return next;
    }

    private FloorPlanLine line(String id) {
        return repo.findLine(id).orElseThrow(() -> new IllegalArgumentException("Unknown floor plan line " + id));
    }

    private FloorPlanUnit unit(String lineId, String unitId) {
        return repo.findUnit(lineId, unitId).orElseThrow(() -> new IllegalArgumentException("Unknown unit " + unitId + " on line " + lineId));
    }

    private void post(String lineId, String unitId, String ref, LocalDate date, List<Entry> entries) {
        String id = lineId + ":" + unitId + ":" + ref;
        ledger.post(PostingBatch.of(tenant, new BatchId(id), new IdempotencyKey(id), date, entries));
    }
}
