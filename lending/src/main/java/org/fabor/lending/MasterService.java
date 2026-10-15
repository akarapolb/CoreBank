package org.fabor.lending;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;

/**
 * Fleet master agreements. A master agreement holds a facility limit, a rate card and a cross-default covenant; each
 * call-off draws a loan of its own at the rate the card gives on the day, and the facility limit is checked against the
 * principal still outstanding across all of them. Billing is consolidated (one invoice across schedules, VAT shown per
 * vehicle) and one payment is spread across schedules oldest due first. A schedule past the covenant's days past due
 * puts the whole agreement in default.
 *
 * <p>Per-vehicle events (substitution, payoff of one vehicle), cost-centre reporting and the TFRS 9 stage 3 treatment
 * of a defaulted agreement are not built yet.
 */
public final class MasterService {
    private final MasterRepo repo;
    private final LoanService loans;
    private final LoanRepo loanRepo;

    public MasterService(MasterRepo repo, LoanService loans, LoanRepo loanRepo) {
        this.repo = repo;
        this.loans = loans;
        this.loanRepo = loanRepo;
    }

    public MasterAgreement sign(String id, String party, String currency, Money limit, String productCode, int productVersion,
                                int crossDefaultDpd, List<MasterAgreement.RateCardRow> rateCard, LocalDate date) {
        if (repo.find(id).isPresent()) {
            throw new IllegalStateException("Master agreement already exists: " + id);
        }
        if (!limit.currency().code().equals(currency)) {
            throw new IllegalArgumentException("The limit must be in " + currency);
        }
        MasterAgreement m = new MasterAgreement(id, party, currency, limit.minor(), productCode, productVersion,
                crossDefaultDpd, List.copyOf(rateCard), MasterAgreement.Status.ACTIVE, date);
        repo.save(m);
        return m;
    }

    /** Principal still outstanding across the agreement's schedules. */
    public Money utilisation(String masterId) {
        MasterAgreement m = load(masterId);
        long used = 0;
        for (MasterAgreement.Schedule s : repo.schedules(masterId)) {
            used += loanRepo.find(s.loanId()).map(l -> l.instalments().stream()
                    .mapToLong(Loan.Instalment::principalOutstanding).sum()).orElse(0L);
        }
        return Money.ofMinor(used, Currency.of(m.currency()));
    }

    public Money headroom(String masterId) {
        return Money.ofMinor(load(masterId).limit(), Currency.of(load(masterId).currency())).minus(utilisation(masterId));
    }

    /**
     * Draws a schedule: a loan for {@code principal} over {@code term} months at the card's rate for the vehicle class on
     * {@code date}, paid out to {@code payoutAccountId} (the dealer) while instalments are collected from
     * {@code customerAccountId}. Refused when the agreement is not active, no card
     * row matches, or the facility has too little headroom. Repeating the same schedule id returns the loan already drawn.
     */
    public Loan callOff(String masterId, String loanId, String vehicleClass, List<String> assetIds, Money principal, int term,
                        LocalDate date, String customerAccountId, String payoutAccountId) {
        MasterAgreement m = load(masterId);
        Optional<MasterAgreement.Schedule> existing = repo.schedules(masterId).stream()
                .filter(s -> s.loanId().equals(loanId)).findFirst();
        if (existing.isPresent()) {
            return loanRepo.find(loanId).orElseThrow();
        }
        if (m.status() != MasterAgreement.Status.ACTIVE) {
            throw new IllegalStateException("Master agreement " + masterId + " is " + m.status());
        }
        if (!principal.currency().code().equals(m.currency())) {
            throw new IllegalArgumentException("A call-off must be in " + m.currency());
        }
        BigDecimal rate = m.rateFor(vehicleClass, term, date).orElseThrow(() -> new IllegalArgumentException(
                "No rate card row for " + vehicleClass + " over " + term + " months on " + date)).rate();
        if (principal.compareTo(headroom(masterId)) > 0) {
            throw new IllegalStateException("The call-off exceeds the facility headroom of " + headroom(masterId).minor());
        }
        Loan loan = loans.disburseAtRate(loanId, m.party(), m.productCode(), m.productVersion(), rate, principal, term, date,
                customerAccountId, payoutAccountId);
        repo.addSchedule(new MasterAgreement.Schedule(masterId, loanId, vehicleClass, rate, term, date, List.copyOf(assetIds)));
        return loan;
    }

    /**
     * The term that makes a new schedule end with the latest existing one: whole months from {@code date} to its last due
     * date, at least one.
     */
    public int coTerminusTerm(String masterId, LocalDate date) {
        LocalDate end = null;
        for (MasterAgreement.Schedule s : repo.schedules(masterId)) {
            Optional<Loan> loan = loanRepo.find(s.loanId());
            if (loan.isPresent() && loan.get().status() != Loan.Status.CLOSED && loan.get().status() != Loan.Status.WRITTEN_OFF) {
                LocalDate last = loan.get().instalments().get(loan.get().instalments().size() - 1).dueDate();
                end = end == null || last.isAfter(end) ? last : end;
            }
        }
        if (end == null) {
            throw new IllegalStateException("Master agreement " + masterId + " has no live schedule to end with");
        }
        return (int) Math.max(1, ChronoUnit.MONTHS.between(date, end));
    }

    /** Everything due and unpaid under the agreement on {@code asOf}, across schedules, oldest first. */
    public ConsolidatedInvoice invoice(String masterId, LocalDate asOf) {
        MasterAgreement m = load(masterId);
        List<ConsolidatedInvoice.Line> lines = new ArrayList<>();
        Map<String, List<String>> assets = new LinkedHashMap<>();
        for (MasterAgreement.Schedule s : repo.schedules(masterId)) {
            assets.put(s.loanId(), s.assetIds());
            Loan loan = loanRepo.find(s.loanId()).orElseThrow();
            for (Loan.Instalment i : loan.instalments()) {
                if (i.billed() && !i.settled() && !i.dueDate().isAfter(asOf)) {
                    lines.add(new ConsolidatedInvoice.Line(s.loanId(), i.number(), i.dueDate(), i.principalOutstanding(),
                            i.interestOutstanding(), i.penaltyOutstanding(), i.vatOutstanding()));
                }
            }
        }
        lines.sort(java.util.Comparator.comparing(ConsolidatedInvoice.Line::dueDate)
                .thenComparing(ConsolidatedInvoice.Line::loanId).thenComparingInt(ConsolidatedInvoice.Line::instalment));
        List<ConsolidatedInvoice.VehicleVat> vehicleVat = new ArrayList<>();
        for (ConsolidatedInvoice.Line l : lines) {
            List<String> ids = assets.get(l.loanId());
            if (l.vat() > 0 && !ids.isEmpty()) {
                long share = l.vat() / ids.size();
                long extra = l.vat() - share * ids.size();   // the remainder goes to the first vehicle
                for (int k = 0; k < ids.size(); k++) {
                    vehicleVat.add(new ConsolidatedInvoice.VehicleVat(l.loanId(), l.instalment(), ids.get(k),
                            share + (k == 0 ? extra : 0)));
                }
            }
        }
        long total = lines.stream().mapToLong(ConsolidatedInvoice.Line::total).sum();
        return new ConsolidatedInvoice(masterId, "MA-" + masterId + "-" + asOf, asOf, m.currency(), List.copyOf(lines),
                List.copyOf(vehicleVat), total);
    }

    /**
     * Spreads one payment over the schedules, oldest due first, each schedule applying its share by its own waterfall.
     * More than is due is refused. Repeating a call is safe: what was already taken under the reference is counted, so a
     * repeat of a finished payment does nothing and a repeat of one that stopped part-way (for example for lack of funds
     * on one schedule's account) pays only the rest, over the schedules not yet paid under that reference.
     */
    public void collect(String masterId, String reference, Money amount, LocalDate date) {
        if (amount.minor() <= 0) {
            throw new IllegalArgumentException("Payment must be positive");
        }
        java.util.Set<String> applied = new java.util.HashSet<>();
        long alreadyPaid = 0;
        for (MasterAgreement.Schedule s : repo.schedules(masterId)) {
            Money paid = loans.amountPaidWith(s.loanId(), reference + "-" + s.loanId());
            if (!paid.isZero()) {
                applied.add(s.loanId());
                alreadyPaid += paid.minor();
            }
        }
        long left = amount.minor() - alreadyPaid;
        if (left < 0) {
            throw new IllegalArgumentException("Reference " + reference + " was already used for a larger payment");
        }
        if (left == 0) {
            return;
        }
        ConsolidatedInvoice inv = invoice(masterId, date);
        long due = inv.lines().stream().filter(l -> !applied.contains(l.loanId())).mapToLong(ConsolidatedInvoice.Line::total).sum();
        if (left > due) {
            throw new IllegalArgumentException("Payment exceeds what is due by " + (left - due));
        }
        Map<String, Long> share = new LinkedHashMap<>();
        for (ConsolidatedInvoice.Line l : inv.lines()) {
            if (applied.contains(l.loanId())) {
                continue;
            }
            long take = Math.min(left, l.total());
            if (take > 0) {
                share.merge(l.loanId(), take, Long::sum);
                left -= take;
            }
        }
        for (Map.Entry<String, Long> e : share.entrySet()) {
            loans.repay(e.getKey(), reference + "-" + e.getKey(), Money.ofMinor(e.getValue(), amount.currency()), date);
        }
    }

    /** Puts the agreement in default if any schedule has reached the covenant's days past due. */
    public MasterAgreement evaluate(String masterId, LocalDate asOf) {
        MasterAgreement m = load(masterId);
        if (m.status() != MasterAgreement.Status.ACTIVE) {
            return m;
        }
        for (MasterAgreement.Schedule s : repo.schedules(masterId)) {
            if (loans.dpd(s.loanId(), asOf) >= m.crossDefaultDpd()) {
                MasterAgreement defaulted = m.withStatus(MasterAgreement.Status.DEFAULTED);
                repo.save(defaulted);
                return defaulted;
            }
        }
        return m;
    }

    /** Takes a defaulted agreement back to active once no schedule is overdue. */
    public MasterAgreement cure(String masterId, LocalDate asOf) {
        MasterAgreement m = load(masterId);
        if (m.status() != MasterAgreement.Status.DEFAULTED) {
            throw new IllegalStateException("Master agreement " + masterId + " is " + m.status() + ", not DEFAULTED");
        }
        for (MasterAgreement.Schedule s : repo.schedules(masterId)) {
            if (loans.dpd(s.loanId(), asOf) > 0) {
                throw new IllegalStateException("Schedule " + s.loanId() + " is still overdue");
            }
        }
        MasterAgreement cured = m.withStatus(MasterAgreement.Status.ACTIVE);
        repo.save(cured);
        return cured;
    }

    public List<MasterAgreement.Schedule> schedules(String masterId) {
        load(masterId);
        return repo.schedules(masterId);
    }

    public Optional<MasterAgreement> find(String masterId) {
        return repo.find(masterId);
    }

    private MasterAgreement load(String id) {
        return repo.find(id).orElseThrow(() -> new IllegalArgumentException("Unknown master agreement " + id));
    }
}
