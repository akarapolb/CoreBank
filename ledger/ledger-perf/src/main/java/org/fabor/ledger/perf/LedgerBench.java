package org.fabor.ledger.perf;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import org.fabor.ledger.adapter.persistence.GroupCommitLedgerStore;
import org.fabor.ledger.adapter.persistence.PostgresLedgerStore;
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

/**
 * Closed-loop load generator against a real database.
 * Usage: LedgerBench jdbcUrl user password threads seconds accounts hot(true|false) [plain|group] [stripes]
 * Each operation is one balanced two-leg transfer. With hot=true every batch also credits one shared fee account.
 */
public final class LedgerBench {
    private LedgerBench() { }

    public static void main(String[] a) throws Exception {
        HikariConfig cfg = new HikariConfig();
        cfg.setJdbcUrl(a[0]);
        cfg.setUsername(a[1]);
        cfg.setPassword(a[2]);
        int threads = Integer.parseInt(a[3]);
        int seconds = Integer.parseInt(a[4]);
        int accounts = Integer.parseInt(a[5]);
        boolean hot = Boolean.parseBoolean(a[6]);
        cfg.setMaximumPoolSize(threads);
        try (HikariDataSource ds = new HikariDataSource(cfg)) {
            Flyway.configure().dataSource(ds).locations("classpath:db/migration/postgresql").cleanDisabled(false)
                    .load().migrate();
            try (var c = ds.getConnection(); var st = c.createStatement()) {
                st.execute("TRUNCATE ledger_entry, ledger_outbox, ledger_batch"
                        + (tableExists(c, "ledger_balance") ? ", ledger_balance" : ""));
            }
            int stripes = a.length > 8 ? Integer.parseInt(a[8]) : 1;
            PostgresLedgerStore plain = new PostgresLedgerStore(ds, java.util.Set.of("fee"), stripes);
            if (a.length > 7 && a[7].equals("group")) {
                try (GroupCommitLedgerStore g = new GroupCommitLedgerStore(plain, 4, 128, 300)) {
                    run(g, threads, seconds, accounts, hot);
                }
            } else {
                run(plain, threads, seconds, accounts, hot);
            }
        }
    }

    private static boolean tableExists(java.sql.Connection c, String t) throws Exception {
        try (var rs = c.getMetaData().getTables(null, null, t, null)) {
            return rs.next();
        }
    }

    static void run(LedgerStore store, int threads, int seconds, int accounts, boolean hot) throws Exception {
        TenantId tenant = new TenantId("bench");
        LocalDate day = LocalDate.of(2026, 1, 1);
        AtomicLong seq = new AtomicLong();
        long[][] lat = new long[threads][];
        long deadline = System.nanoTime() + seconds * 1_000_000_000L;
        Thread[] ts = new Thread[threads];
        for (int t = 0; t < threads; t++) {
            int idx = t;
            ts[t] = new Thread(() -> {
                long[] buf = new long[1 << 20];
                int n = 0;
                ThreadLocalRandom r = ThreadLocalRandom.current();
                while (System.nanoTime() < deadline && n < buf.length) {
                    long id = seq.incrementAndGet();
                    int from = r.nextInt(accounts);
                    int to = (from + 1 + r.nextInt(accounts - 1)) % accounts;
                    Money amt = Money.ofMinor(2 + r.nextInt(1000), Currency.THB);
                    List<Entry> es = hot
                            ? List.of(e("acc-" + from, Direction.DEBIT, amt), e("acc-" + to, Direction.CREDIT, amt.minus(Money.ofMinor(1, Currency.THB))),
                                    e("fee", Direction.CREDIT, Money.ofMinor(1, Currency.THB)))
                            : List.of(e("acc-" + from, Direction.DEBIT, amt), e("acc-" + to, Direction.CREDIT, amt));
                    PostingBatch b = PostingBatch.of(tenant, new BatchId("b" + id), new IdempotencyKey("k" + id), day, es);
                    long t0 = System.nanoTime();
                    store.append(b, Instant.now());
                    buf[n++] = System.nanoTime() - t0;
                }
                lat[idx] = Arrays.copyOf(buf, n);
            });
            ts[t].start();
        }
        long start = System.nanoTime();
        for (Thread t : ts) {
            t.join();
        }
        double secs = (System.nanoTime() - start) / 1e9;
        long[] all = Arrays.stream(lat).flatMapToLong(Arrays::stream).sorted().toArray();
        System.out.printf("threads=%d accounts=%d hot=%b  batches=%d  throughput=%.0f/s  p50=%.1fms p99=%.1fms max=%.1fms%n",
                threads, accounts, hot, all.length, all.length / secs, pct(all, .5), pct(all, .99), pct(all, 1.0));
    }

    private static Entry e(String acct, Direction d, Money m) {
        return new Entry(new AccountId(acct), BalanceType.SETTLED, d, m);
    }

    private static double pct(long[] sorted, double p) {
        return sorted.length == 0 ? 0 : sorted[(int) Math.min(sorted.length - 1, Math.floor(p * sorted.length))] / 1e6;
    }
}
