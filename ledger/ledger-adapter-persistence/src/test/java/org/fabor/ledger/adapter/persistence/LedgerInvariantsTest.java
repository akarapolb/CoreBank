package org.fabor.ledger.adapter.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.Statement;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.fabor.ledger.application.IdempotencyConflictException;
import org.fabor.ledger.application.InsufficientFundsException;
import org.fabor.ledger.application.InvalidReversalException;
import org.fabor.ledger.application.LedgerStore;
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
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.postgresql.ds.PGSimpleDataSource;

/**
 * Randomised concurrent workload (deposits, guarded transfers, holds, reversals, retries) followed by
 * the database-level integrity check. The workload is seeded, so a failure reproduces.
 */
class LedgerInvariantsTest {
    private static final TenantId T = new TenantId("inv");
    private static final LocalDate D = LocalDate.of(2026, 1, 1);
    private static PGSimpleDataSource ds;

    @BeforeAll
    static void migrate() {
        ds = PgSupport.dataSource();
        Assumptions.assumeTrue(ds != null, "No PostgreSQL; skipping");
        Flyway.configure().dataSource(ds).locations("classpath:db/migration/postgresql").cleanDisabled(false)
                .load().migrate();
    }

    private static void reset() throws Exception {
        try (Connection c = ds.getConnection(); Statement st = c.createStatement()) {
            st.execute("TRUNCATE ledger_entry, ledger_outbox, ledger_balance, ledger_batch");
        }
    }

    @Test
    void plainStoreKeepsInvariantsUnderConcurrentLoad() throws Exception {
        reset();
        workloadAndVerify(new PostgresLedgerStore(ds));
    }

    @Test
    void groupCommitKeepsInvariantsUnderConcurrentLoad() throws Exception {
        reset();
        try (GroupCommitLedgerStore store = new GroupCommitLedgerStore(new PostgresLedgerStore(ds), 3, 64, 200)) {
            workloadAndVerify(store);
        }
    }

    @Test
    void stripedHotAccountKeepsInvariants() throws Exception {
        reset();
        workloadAndVerify(new PostgresLedgerStore(ds, java.util.Set.of("bank-cash"), 8));
    }

    private static Money thb(long m) {
        return Money.ofMinor(m, Currency.THB);
    }

    private void workloadAndVerify(LedgerStore store) throws Exception {
        int accounts = 20;
        AccountId bank = new AccountId("bank-cash");
        for (int i = 0; i < accounts; i++) {
            AccountId a = new AccountId("acc-" + i);
            store.append(PostingBatch.of(T, new BatchId("seed-" + i), new IdempotencyKey("seed-" + i), D, List.of(
                    new Entry(bank, BalanceType.SETTLED, Direction.DEBIT, thb(100_000)),
                    new Entry(a, BalanceType.SETTLED, Direction.CREDIT, thb(100_000)))), Instant.now());
        }
        ConcurrentLinkedQueue<PostingBatch> reversible = new ConcurrentLinkedQueue<>();
        ExecutorService pool = Executors.newFixedThreadPool(16);
        List<Future<?>> fs = new ArrayList<>();
        for (int t = 0; t < 16; t++) {
            long seed = 1234L + t;
            int thread = t;
            fs.add(pool.submit(() -> {
                Random r = new Random(seed);
                for (int n = 0; n < 250; n++) {
                    String id = "t" + thread + "-" + n;
                    AccountId a = new AccountId("acc-" + r.nextInt(accounts));
                    AccountId b = new AccountId("acc-" + r.nextInt(accounts));
                    if (a.equals(b)) {
                        continue;
                    }
                    long amt = 1 + r.nextInt(30_000);
                    try {
                        int kind = r.nextInt(10);
                        if (kind < 6) { // guarded transfer, may be refused
                            PostingBatch p = PostingBatch.of(T, new BatchId(id), new IdempotencyKey(id), D, List.of(
                                    Entry.guardedDebit(a, BalanceType.SETTLED, thb(amt)),
                                    new Entry(b, BalanceType.SETTLED, Direction.CREDIT, thb(amt))));
                            store.append(p, Instant.now());
                            store.append(p, Instant.now()); // retry must replay, never double post
                            reversible.add(p);
                        } else if (kind < 8) { // hold
                            store.append(PostingBatch.of(T, new BatchId(id), new IdempotencyKey(id), D, List.of(
                                    Entry.guardedDebit(a, BalanceType.SETTLED, thb(amt)),
                                    new Entry(a, BalanceType.HOLD, Direction.CREDIT, thb(amt)))), Instant.now());
                        } else { // reverse a transfer that is not already reversed
                            PostingBatch p = reversible.poll();
                            if (p != null) {
                                store.append(p.reversal(new BatchId(id), new IdempotencyKey(id), D), Instant.now());
                            }
                        }
                    } catch (InsufficientFundsException | InvalidReversalException | IdempotencyConflictException e) {
                        // legitimate refusals
                    }
                }
            }));
        }
        for (Future<?> f : fs) {
            f.get(120, TimeUnit.SECONDS);
        }
        pool.shutdownNow();

        LedgerIntegrityCheck.Report report = new LedgerIntegrityCheck(ds).run();
        assertThat(report.batchesChecked()).isGreaterThan(accounts);
        assertThat(report.ok()).as(report.toString()).isTrue();

        long total = 0;
        for (int i = 0; i < accounts; i++) {
            AccountId a = new AccountId("acc-" + i);
            long settled = store.currentBalance(T, a, BalanceType.SETTLED, Currency.THB).minor();
            // reversals of transfers can only take funds from receivers that spent them; allow that, but
            // the books must still balance globally
            total += settled + store.currentBalance(T, a, BalanceType.HOLD, Currency.THB).minor();
        }
        long cash = store.currentBalance(T, bank, BalanceType.SETTLED, Currency.THB).minor();
        assertThat(total + cash).isZero();
        assertThat(total).isEqualTo(accounts * 100_000L);
    }
}
