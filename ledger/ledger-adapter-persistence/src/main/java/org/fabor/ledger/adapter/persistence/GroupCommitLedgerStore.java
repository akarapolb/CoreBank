package org.fabor.ledger.adapter.persistence;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.fabor.ledger.application.LedgerStore;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.ledger.domain.PostingBatch;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.TenantId;

/**
 * Group commit: concurrent {@code append} calls are queued and written by a few flusher threads, each
 * committing many batches in one transaction. This amortises the log flush (the dominant cost per
 * commit) across the group while every caller still returns only after its batch is durable.
 * Reversals and batches with {@code requireFunds} entries bypass the group (they need to see committed
 * state before they write) and, like reads, go straight to the underlying store.
 */
public final class GroupCommitLedgerStore implements LedgerStore, AutoCloseable {
    private record Request(PostingBatch batch, Instant at, CompletableFuture<PostResult> done) { }

    private final JdbcLedgerStore delegate;
    private final BlockingQueue<Request> queue = new LinkedBlockingQueue<>();
    private final Thread[] flushers;
    private final int maxGroup;
    private final long lingerNanos;
    private volatile boolean running = true;

    public GroupCommitLedgerStore(JdbcLedgerStore delegate, int flusherCount, int maxGroup, long lingerMicros) {
        this.delegate = delegate;
        this.maxGroup = maxGroup;
        this.lingerNanos = TimeUnit.MICROSECONDS.toNanos(lingerMicros);
        this.flushers = new Thread[flusherCount];
        for (int i = 0; i < flusherCount; i++) {
            flushers[i] = Thread.ofPlatform().daemon().name("ledger-flusher-" + i).start(this::loop);
        }
    }

    @Override
    public PostResult append(PostingBatch batch, Instant recordedAt) {
        if (batch.reverses().isPresent() || !running || batch.entries().stream().anyMatch(org.fabor.ledger.domain.Entry::requireFunds)) {
            return delegate.append(batch, recordedAt);
        }
        Request r = new Request(batch, recordedAt, new CompletableFuture<>());
        queue.add(r);
        try {
            return r.done().get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while waiting for commit", e);
        } catch (ExecutionException e) {
            if (e.getCause() instanceof RuntimeException re) {
                throw re;
            }
            throw new IllegalStateException(e.getCause());
        }
    }

    private void loop() {
        List<Request> group = new ArrayList<>(maxGroup);
        while (running || !queue.isEmpty()) {
            try {
                Request first = queue.poll(100, TimeUnit.MILLISECONDS);
                if (first == null) {
                    continue;
                }
                group.add(first);
                queue.drainTo(group, maxGroup - 1);
                long until = System.nanoTime() + lingerNanos;
                while (group.size() < maxGroup && System.nanoTime() < until) {
                    Request next = queue.poll(until - System.nanoTime(), TimeUnit.NANOSECONDS);
                    if (next == null) {
                        break;
                    }
                    group.add(next);
                    queue.drainTo(group, maxGroup - group.size());
                }
                flush(group);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } finally {
                group.clear();
            }
        }
    }

    private void flush(List<Request> group) {
        List<Object> results;
        try {
            results = delegate.appendAll(group.stream().map(Request::batch).toList(),
                    group.stream().map(Request::at).toList());
        } catch (RuntimeException e) {
            group.forEach(r -> r.done().completeExceptionally(e));
            return;
        }
        for (int i = 0; i < group.size(); i++) {
            Object o = results.get(i);
            if (o instanceof PostResult pr) {
                group.get(i).done().complete(pr);
            } else {
                group.get(i).done().completeExceptionally((Throwable) o);
            }
        }
    }

    @Override
    public Optional<StoredBatch> find(TenantId tenant, BatchId id) {
        return delegate.find(tenant, id);
    }

    @Override
    public Money balance(TenantId tenant, AccountId account, BalanceType type, Currency currency,
                         LocalDate valueAsOf, Instant recordedAsOf) {
        return delegate.balance(tenant, account, type, currency, valueAsOf, recordedAsOf);
    }

    @Override
    public Money currentBalance(TenantId tenant, AccountId account, BalanceType type, Currency currency) {
        return delegate.currentBalance(tenant, account, type, currency);
    }

    @Override
    public java.util.List<AccountId> accounts(TenantId tenant) {
        return delegate.accounts(tenant);
    }

    @Override
    public void close() {
        running = false;
        for (Thread t : flushers) {
            try {
                t.join(5_000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }
}
