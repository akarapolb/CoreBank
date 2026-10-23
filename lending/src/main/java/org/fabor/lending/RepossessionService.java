package org.fabor.lending;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.fabor.assets.Asset;
import org.fabor.assets.AssetService;
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
 * Repossession and remarketing of the asset behind a defaulted loan.
 *
 * <p>{@link #repossess} takes the asset back (the register moves it to REPOSSESSED) and opens a case; the loan is
 * unchanged. {@link #sell} remarkets it: the sale proceeds less the costs of recovering and selling go to the
 * customer's deposit account and are applied to the debt from there. If they clear the loan's settlement quote the
 * loan closes and any surplus stays with the customer. If they fall short, the loan is written off (an approved
 * exception, since repossession is itself the decision), the net proceeds are booked as a recovery and the shortfall is
 * left on the written-off memo as a claim on the customer. Every posting has a deterministic id, so repeating a call
 * that succeeded changes nothing; a failure part-way through a sale needs a person to check the case before it is
 * retried. Costs are treated as paid to third parties out of the proceeds; accruing them before the sale, and the
 * customer's right to redeem the asset before it is sold, are not handled yet.
 */
public final class RepossessionService {
    public static final AccountId COSTS_PAYABLE = new AccountId("gl:repossession-costs-payable");

    private final TenantId tenant;
    private final LedgerService ledger;
    private final LoanService loans;
    private final LoanRepo loanRepo;
    private final AssetService assets;
    private final RepossessionRepo repo;

    public RepossessionService(TenantId tenant, LedgerService ledger, LoanService loans, LoanRepo loanRepo, AssetService assets,
                               RepossessionRepo repo) {
        this.tenant = tenant;
        this.ledger = ledger;
        this.loans = loans;
        this.loanRepo = loanRepo;
        this.assets = assets;
        this.repo = repo;
    }

    /** Takes the asset back from a loan that is overdue. Idempotent per reference. */
    public Repossession repossess(String reference, String loanId, String assetId, LocalDate date, String location,
                                  Asset.Condition condition) {
        var existing = repo.find(reference);
        if (existing.isPresent()) {
            return existing.get();
        }
        Loan loan = loanRepo.find(loanId).orElseThrow(() -> new IllegalArgumentException("Unknown loan " + loanId));
        if (loan.status() != Loan.Status.ACTIVE && loan.status() != Loan.Status.NON_ACCRUAL) {
            throw new IllegalStateException("Loan " + loanId + " is " + loan.status());
        }
        boolean overdue = loan.instalments().stream().anyMatch(i -> i.billed() && !i.settled() && i.dueDate().isBefore(date));
        if (!overdue) {
            throw new IllegalStateException("Loan " + loanId + " has nothing overdue on " + date);
        }
        Asset asset = assets.find(assetId).orElseThrow(() -> new IllegalArgumentException("Unknown asset " + assetId));
        if (!loanId.equals(asset.contractId())) {
            throw new IllegalArgumentException("Asset " + assetId + " does not secure loan " + loanId);
        }
        assets.repossess(assetId, location, condition);
        Repossession r = new Repossession(reference, loanId, assetId, date, location, Repossession.Status.OPEN, null, 0, 0, 0, 0, 0);
        repo.save(r);
        return r;
    }

    /** Sells the repossessed asset and applies the net proceeds to the debt. Idempotent per case. */
    public Repossession sell(String reference, LocalDate date, Money proceeds, Money costs) {
        Repossession r = repo.find(reference).orElseThrow(() -> new IllegalArgumentException("Unknown repossession " + reference));
        if (r.status() == Repossession.Status.SOLD) {
            return r;
        }
        if (proceeds.minor() <= 0 || costs.minor() < 0 || costs.minor() > proceeds.minor()) {
            throw new IllegalArgumentException("Proceeds must be positive and the costs no more than the proceeds");
        }
        Loan loan = loanRepo.find(r.loanId()).orElseThrow();
        Currency cur = Currency.of(loan.currency());
        long net = proceeds.minor() - costs.minor();
        List<Entry> entries = new ArrayList<>();
        entries.add(new Entry(new AccountId("gl:cash"), BalanceType.SETTLED, Direction.DEBIT, proceeds));
        if (net > 0) {
            entries.add(new Entry(new AccountId("dep:" + loan.depositAccountId()), BalanceType.SETTLED, Direction.CREDIT,
                    Money.ofMinor(net, cur)));
        }
        if (costs.minor() > 0) {
            entries.add(new Entry(COSTS_PAYABLE, BalanceType.SETTLED, Direction.CREDIT, costs));
        }
        String id = r.loanId() + ":reposs-sale-" + reference;
        if (ledger.find(tenant, new BatchId(id)).isEmpty()) {
            ledger.post(PostingBatch.of(tenant, new BatchId(id), new IdempotencyKey(id), date, entries));
        }
        long owed = loans.settlementQuote(r.loanId(), date).minor();
        long shortfall;
        long surplus;
        if (net >= owed) {
            loans.settle(r.loanId(), "reposs-" + reference, date);
            shortfall = 0;
            surplus = net - owed;
        } else {
            long claim = writeOffTotal(loan);
            loans.writeOff(r.loanId(), "reposs-" + reference, date, true);
            long applied = Math.min(net, claim);
            if (applied > 0) {
                loans.recover(r.loanId(), "reposs-" + reference, Money.ofMinor(applied, cur), date);
            }
            shortfall = claim - applied;
            surplus = net - applied;
        }
        assets.sellRepossessed(r.assetId());
        Repossession sold = r.sold(date, proceeds.minor(), costs.minor(), owed, shortfall, surplus);
        repo.save(sold);
        return sold;
    }

    public java.util.Optional<Repossession> find(String reference) {
        return repo.find(reference);
    }

    public List<Repossession> forLoan(String loanId) {
        return repo.forLoan(loanId);
    }

    /** What a write-off clears: the same sum {@link LoanService#writeOff} books. */
    private static long writeOffTotal(Loan loan) {
        long total = 0;
        for (Loan.Instalment i : loan.instalments()) {
            total += i.principalOutstanding() + i.vatOutstanding()
                    + (i.billed() ? i.interestOutstanding() + i.penaltyOutstanding() : 0);
        }
        return total;
    }
}
