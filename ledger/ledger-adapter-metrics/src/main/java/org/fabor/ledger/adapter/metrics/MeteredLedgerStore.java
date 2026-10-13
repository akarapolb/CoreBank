package org.fabor.ledger.adapter.metrics;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import org.fabor.ledger.application.IdempotencyConflictException;
import org.fabor.ledger.application.InsufficientFundsException;
import org.fabor.ledger.application.InvalidReversalException;
import org.fabor.ledger.application.LedgerStore;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.ledger.domain.PostingBatch;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.TenantId;

/**
 * RED metrics for the ledger (rate, errors, duration). Tags are low-cardinality on purpose: outcome and
 * operation only, never tenant or account. Names are the contract used by the dashboards and alerts in
 * {@code deploy/observability}.
 */
public final class MeteredLedgerStore implements LedgerStore {
    public static final String APPEND = "fabor.ledger.append";
    public static final String READ = "fabor.ledger.read";

    private final LedgerStore delegate;
    private final MeterRegistry registry;

    public MeteredLedgerStore(LedgerStore delegate, MeterRegistry registry) {
        this.delegate = delegate;
        this.registry = registry;
    }

    @Override
    public PostResult append(PostingBatch batch, Instant recordedAt) {
        Timer.Sample sample = Timer.start(registry);
        String outcome = "ok";
        try {
            PostResult r = delegate.append(batch, recordedAt);
            if (r.replayed()) {
                outcome = "replay";
            }
            return r;
        } catch (IdempotencyConflictException e) {
            outcome = "idempotency_conflict";
            throw e;
        } catch (InsufficientFundsException e) {
            outcome = "insufficient_funds";
            throw e;
        } catch (InvalidReversalException e) {
            outcome = "invalid_reversal";
            throw e;
        } catch (RuntimeException e) {
            outcome = "error";
            throw e;
        } finally {
            sample.stop(Timer.builder(APPEND).description("Ledger append duration by outcome")
                    .publishPercentiles(0.5, 0.99).tag("outcome", outcome).register(registry));
        }
    }

    @Override
    public Optional<StoredBatch> find(TenantId tenant, BatchId id) {
        return timed("find", () -> delegate.find(tenant, id));
    }

    @Override
    public Money balance(TenantId tenant, AccountId account, BalanceType type, Currency currency,
                         LocalDate valueAsOf, Instant recordedAsOf) {
        return timed("balance", () -> delegate.balance(tenant, account, type, currency, valueAsOf, recordedAsOf));
    }

    @Override
    public Money currentBalance(TenantId tenant, AccountId account, BalanceType type, Currency currency) {
        return timed("current_balance", () -> delegate.currentBalance(tenant, account, type, currency));
    }

    @Override
    public java.util.List<AccountId> accounts(TenantId tenant) {
        return timed("accounts", () -> delegate.accounts(tenant));
    }

    private <T> T timed(String op, java.util.function.Supplier<T> call) {
        return Timer.builder(READ).tag("op", op).publishPercentiles(0.5, 0.99).register(registry)
                .record(call);
    }
}
