package org.fabor.assets;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
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
 * The dealer channel: onboarding, suspension, and paying a dealer for an asset it delivered.
 *
 * <p>The payout settles the supplier payable that a finance-lease booking creates (debit supplier payable, credit
 * cash) and pays the dealer's commission on top (debit deferred dealer commission, credit cash). The deferred
 * commission is meant to be amortised through the effective interest rate (TFRS 9), which is not built yet. A loan
 * that finances a dealer sale is instead disbursed to an account the dealer holds. Each asset is paid once.
 */
public final class DealerService {
    public static final AccountId SUPPLIER_PAYABLE = new AccountId("gl:supplier-payable");
    public static final AccountId CASH = new AccountId("gl:cash");
    public static final AccountId COMMISSION_DEFERRED = new AccountId("gl:dealer-commission-deferred");

    private final TenantId tenant;
    private final LedgerService ledger;
    private final DealerRepo dealers;
    private final AssetRepo assets;

    public DealerService(TenantId tenant, LedgerService ledger, DealerRepo dealers, AssetRepo assets) {
        this.tenant = tenant;
        this.ledger = ledger;
        this.dealers = dealers;
        this.assets = assets;
    }

    public Dealer onboard(String id, String name, String taxId, BigDecimal commissionRate) {
        if (dealers.find(id).isPresent()) {
            throw new IllegalStateException("Dealer already exists: " + id);
        }
        Dealer d = new Dealer(id, name, taxId, Dealer.Status.ACTIVE, commissionRate);
        dealers.save(d);
        return d;
    }

    public Dealer suspend(String id) {
        return setStatus(id, Dealer.Status.SUSPENDED);
    }

    public Dealer reinstate(String id) {
        return setStatus(id, Dealer.Status.ACTIVE);
    }

    public java.util.Optional<Dealer> find(String id) {
        return dealers.find(id);
    }

    public List<Dealer> all() {
        return dealers.all();
    }

    /** The commission owed on an asset of this cost, rounded half-up to the satang. */
    public Money commission(String dealerId, Money cost) {
        return cost.times(load(dealerId).commissionRate(), RoundingMode.HALF_UP);
    }

    /**
     * Pays the dealer for an active asset: the cost, plus commission. The dealer must be active. Paying the same asset
     * again changes nothing.
     */
    public Money payDealer(String assetId, LocalDate date) {
        Asset a = assets.find(assetId).orElseThrow(() -> new IllegalArgumentException("Unknown asset " + assetId));
        if (a.status() != Asset.Status.ACTIVE) {
            throw new IllegalStateException("Asset " + assetId + " is " + a.status() + ": the dealer is paid once it is active");
        }
        Dealer d = load(a.dealerId());
        if (d.status() != Dealer.Status.ACTIVE) {
            throw new IllegalStateException("Dealer " + d.id() + " is " + d.status());
        }
        Currency cur = Currency.of(a.currency());
        Money cost = Money.ofMinor(a.cost(), cur);
        Money commission = commission(d.id(), cost);
        List<Entry> entries = new ArrayList<>();
        entries.add(new Entry(SUPPLIER_PAYABLE, BalanceType.SETTLED, Direction.DEBIT, cost));
        entries.add(new Entry(CASH, BalanceType.SETTLED, Direction.CREDIT, cost));
        if (!commission.isZero()) {
            entries.add(new Entry(COMMISSION_DEFERRED, BalanceType.SETTLED, Direction.DEBIT, commission));
            entries.add(new Entry(CASH, BalanceType.SETTLED, Direction.CREDIT, commission));
        }
        String ref = "asset:" + assetId + ":dealer-payout";
        ledger.post(PostingBatch.of(tenant, new BatchId(ref), new IdempotencyKey(ref), date, entries));
        return cost.plus(commission);
    }

    private Dealer setStatus(String id, Dealer.Status status) {
        Dealer d = load(id).withStatus(status);
        dealers.save(d);
        return d;
    }

    private Dealer load(String id) {
        return dealers.find(id).orElseThrow(() -> new IllegalArgumentException("Unknown dealer " + id));
    }
}
