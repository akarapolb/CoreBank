package org.fabor.app;

import java.time.LocalDate;
import java.util.List;
import org.fabor.ledger.application.LedgerStore;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.Direction;
import org.fabor.lending.Loan;
import org.fabor.lending.LoanRepo;
import org.fabor.lending.LoanService;
import org.fabor.onboarding.Party;
import org.fabor.onboarding.Ports;
import org.fabor.platform.money.Currency;
import org.fabor.platform.tenancy.TenantId;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Read-only views for the staff console: a customer with their contracts, one contract in full, an account statement. */
@RestController
@RequestMapping("/api/v1")
class StaffViewController {
    private final Ports.PartyRepo parties;
    private final LoanRepo loanRepo;
    private final LoanService loans;
    private final LedgerStore ledger;
    private final TenantId tenant;
    private final Lifecycle lifecycle;

    StaffViewController(Ports.PartyRepo parties, LoanRepo loanRepo, LoanService loans, LedgerStore ledger, TenantId tenant,
                        Lifecycle lifecycle) {
        this.parties = parties;
        this.loanRepo = loanRepo;
        this.loans = loans;
        this.ledger = ledger;
        this.tenant = tenant;
        this.lifecycle = lifecycle;
    }

    record ContractRef(String id, String status, long principalMinor) { }

    /** Tokens only, never the personal data itself. */
    record CustomerView(String partyId, String status, String depositAccountId, List<ContractRef> loans) { }

    record InstalmentView(int number, LocalDate dueDate, long principalMinor, long interestMinor, long principalPaidMinor,
                          long interestPaidMinor, long penaltyMinor, boolean billed, boolean settled) { }

    record LoanDetail(String id, String party, String productCode, int productVersion, String status, String currency,
                      LocalDate disbursedOn, long principalMinor, long outstandingMinor, java.math.BigDecimal rateOverride,
                      int generation, int dpd, List<InstalmentView> instalments) { }

    @GetMapping("/customers/{id}")
    CustomerView customer(Actor actor, @PathVariable String id) {
        actor.require("ops");
        Party p = parties.find(id).orElseThrow(() -> new IllegalArgumentException("No such customer " + id));
        List<ContractRef> refs = loanRepo.idsByParty(id).stream().map(l -> loanRepo.find(l).orElseThrow())
                .map(l -> new ContractRef(l.id(), l.status().name(), l.principal())).toList();
        return new CustomerView(p.id(), p.status().name(), p.depositAccountId(), refs);
    }

    @GetMapping("/loans/{id}/detail")
    LoanDetail detail(Actor actor, @PathVariable String id, @RequestParam(required = false) LocalDate asOf) {
        actor.require("ops");
        LocalDate day = asOf == null ? lifecycle.today() : asOf;
        Loan l = loanRepo.find(id).orElseThrow(() -> new IllegalArgumentException("No such loan " + id));
        List<InstalmentView> rows = l.instalments().stream().map(i -> new InstalmentView(i.number(), i.dueDate(), i.principalDue(),
                i.interestDue(), i.principalPaid(), i.interestPaid(), i.penaltyAccrued(), i.billed(), i.settled())).toList();
        long outstanding = l.instalments().stream().mapToLong(Loan.Instalment::principalOutstanding).sum();
        return new LoanDetail(l.id(), l.party(), l.productCode(), l.productVersion(), l.status().name(), l.currency(), l.disbursedOn(),
                l.principal(), outstanding, l.rateOverride(), l.generation(), loans.dpd(id, day), rows);
    }

    /** One row of the loan list: enough to recognise the loan and decide whether to open it. */
    record LoanRow(String id, String party, String productCode, int productVersion, String status, String currency, LocalDate disbursedOn,
                   long principalMinor, long outstandingMinor, long overdueMinor, int dpd) { }

    /**
     * Loans, newest first: {@code q} matches the loan id, the customer or the product (case-insensitive), {@code status} one
     * status, {@code overdue} only loans with something billed and unpaid past its due date. Reads every loan, so it is a
     * first version: a large book needs an indexed search.
     */
    @GetMapping("/loans")
    List<LoanRow> loans(Actor actor, @RequestParam(required = false) String q, @RequestParam(required = false) String status,
                        @RequestParam(defaultValue = "false") boolean overdue, @RequestParam(defaultValue = "200") int limit) {
        actor.require("ops");
        LocalDate day = lifecycle.today();
        String needle = q == null ? "" : q.trim().toLowerCase(java.util.Locale.ROOT);
        java.util.List<LoanRow> out = new java.util.ArrayList<>();
        for (String id : loanRepo.allIds()) {
            Loan l = loanRepo.find(id).orElseThrow();
            if (status != null && !status.isBlank() && !l.status().name().equalsIgnoreCase(status)) {
                continue;
            }
            if (!needle.isEmpty() && !(l.id().toLowerCase(java.util.Locale.ROOT).contains(needle)
                    || l.party().toLowerCase(java.util.Locale.ROOT).contains(needle)
                    || l.productCode().toLowerCase(java.util.Locale.ROOT).contains(needle))) {
                continue;
            }
            long overdueMinor = l.instalments().stream().filter(i -> i.billed() && !i.settled() && i.dueDate().isBefore(day))
                    .mapToLong(Loan.Instalment::outstanding).sum();
            if (overdue && overdueMinor == 0) {
                continue;
            }
            long outstanding = l.instalments().stream().mapToLong(Loan.Instalment::principalOutstanding).sum();
            boolean live = l.status() != Loan.Status.CLOSED && l.status() != Loan.Status.WRITTEN_OFF;
            out.add(new LoanRow(l.id(), l.party(), l.productCode(), l.productVersion(), l.status().name(), l.currency(), l.disbursedOn(),
                    l.principal(), outstanding, overdueMinor, live ? loans.dpd(id, day) : 0));
        }
        out.sort(java.util.Comparator.comparing(LoanRow::disbursedOn).reversed().thenComparing(LoanRow::id));
        return out.subList(0, Math.min(out.size(), Math.max(1, Math.min(limit, 1000))));
    }

    record Leg(String account, String balanceType, String direction, long minor, String currency) { }

    record BatchView(String id, LocalDate valueDate, java.time.Instant recordedAt, String reason, String origin, List<Leg> legs) { }

    /**
     * The newest batches touching one ledger account ({@code dep:SAV-P1}, {@code loan:LN-1:principal}, {@code gl:vat-payable}),
     * each with all of its legs. Origin is read from the posting id scheme: scheduler postings are SYSTEM, the rest follow a
     * customer or staff instruction (HUMAN).
     */
    @GetMapping("/ledger/batches")
    List<BatchView> batches(Actor actor, @RequestParam String account, @RequestParam(defaultValue = "20") int limit) {
        actor.require("ops");
        int n = Math.max(1, Math.min(limit, 100));
        AccountId acct = new AccountId(account);
        java.util.Map<String, LedgerStore.EntryRecord> newest = new java.util.LinkedHashMap<>();
        for (BalanceType t : BalanceType.values()) {
            for (LedgerStore.EntryRecord e : ledger.entries(tenant, acct, t, Currency.THB, lifecycle.today(), n)) {
                newest.merge(e.batchId().value(), e, (x, y) -> x);
            }
        }
        return newest.values().stream().sorted(java.util.Comparator.comparing(LedgerStore.EntryRecord::recordedAt).reversed()).limit(n)
                .map(e -> ledger.find(tenant, e.batchId()).orElseThrow()).map(sb -> {
                    var b = sb.batch();
                    String key = b.id().value();
                    return new BatchView(key, b.valueDate(), sb.recordedAt(), MeController.label(key), origin(key),
                            b.entries().stream().map(x -> new Leg(x.account().value(), x.type().name(),
                                    x.direction() == Direction.DEBIT ? "DR" : "CR", x.amount().minor(), x.amount().currency().code())).toList());
                }).toList();
    }

    static String origin(String batchId) {
        String id = batchId.contains(":") ? batchId.substring(batchId.indexOf(':') + 1) : batchId;
        boolean scheduled = id.startsWith("int-") || id.contains("bill-") || id.contains("pen-") || id.contains("accrue") || id.equals("disburse")
                || id.endsWith("disburse") || id.contains("nonaccrual");
        return scheduled ? "SYSTEM" : "HUMAN";
    }
}
