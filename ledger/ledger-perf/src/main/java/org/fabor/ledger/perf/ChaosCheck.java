package org.fabor.ledger.perf;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.io.BufferedWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicLong;
import org.fabor.ledger.adapter.persistence.GroupCommitLedgerStore;
import org.fabor.ledger.adapter.persistence.LedgerIntegrityCheck;
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
 * Crash-safety check, driven by scripts/chaos-kill-primary.sh.
 * <pre>
 *   write  url user pass threads seconds ackFile plain|group   load that survives database restarts
 *   verify url user pass ackFile                               every acknowledged batch must exist; integrity must hold
 * </pre>
 * A batch is "acknowledged" only after {@code append} returned, i.e. after commit. Batches in flight when
 * the database died may or may not exist; acknowledged ones must always exist.
 */
public final class ChaosCheck {
    private ChaosCheck() { }

    public static void main(String[] a) throws Exception {
        if (a[0].equals("write")) {
            write(a);
        } else {
            System.exit(verify(a));
        }
    }

    private static HikariDataSource pool(String url, String user, String pass, int size) {
        HikariConfig cfg = new HikariConfig();
        cfg.setJdbcUrl(url);
        cfg.setUsername(user);
        cfg.setPassword(pass);
        cfg.setMaximumPoolSize(size);
        cfg.setConnectionTimeout(2_000);
        cfg.setInitializationFailTimeout(-1);
        return new HikariDataSource(cfg);
    }

    private static void write(String[] a) throws Exception {
        int threads = Integer.parseInt(a[4]);
        int seconds = Integer.parseInt(a[5]);
        Path ackFile = Path.of(a[6]);
        try (HikariDataSource ds = pool(a[1], a[2], a[3], threads + 4)) {
            Flyway.configure().dataSource(ds).locations("classpath:db/migration/postgresql").cleanDisabled(false)
                    .load().migrate();
            try (Connection c = ds.getConnection(); var st = c.createStatement()) {
                st.execute("TRUNCATE ledger_entry, ledger_outbox, ledger_balance, ledger_batch");
            }
            PostgresLedgerStore plain = new PostgresLedgerStore(ds);
            boolean group = a.length > 7 && a[7].equals("group");
            LedgerStore store = group ? new GroupCommitLedgerStore(plain, 4, 64, 300) : plain;
            TenantId tenant = new TenantId("chaos");
            AtomicLong seq = new AtomicLong();
            AtomicLong acked = new AtomicLong();
            AtomicLong failed = new AtomicLong();
            long deadline = System.nanoTime() + seconds * 1_000_000_000L;
            try (BufferedWriter out = Files.newBufferedWriter(ackFile)) {
                Thread[] ts = new Thread[threads];
                for (int t = 0; t < threads; t++) {
                    ts[t] = new Thread(() -> {
                        ThreadLocalRandom r = ThreadLocalRandom.current();
                        while (System.nanoTime() < deadline) {
                            long id = seq.incrementAndGet();
                            Money amt = Money.ofMinor(1 + r.nextInt(1000), Currency.THB);
                            PostingBatch b = PostingBatch.of(tenant, new BatchId("c" + id), new IdempotencyKey("c" + id),
                                    LocalDate.of(2026, 1, 1), List.of(
                                            new Entry(new AccountId("a" + r.nextInt(5000)), BalanceType.SETTLED, Direction.DEBIT, amt),
                                            new Entry(new AccountId("a" + r.nextInt(5000)), BalanceType.SETTLED, Direction.CREDIT, amt)));
                            try {
                                store.append(b, Instant.now());
                                synchronized (out) {
                                    out.write("c" + id + "\n");
                                    out.flush();
                                }
                                acked.incrementAndGet();
                            } catch (RuntimeException | java.io.IOException e) {
                                failed.incrementAndGet();
                                try {
                                    Thread.sleep(50);
                                } catch (InterruptedException ie) {
                                    return;
                                }
                            }
                        }
                    });
                    ts[t].start();
                }
                for (Thread t : ts) {
                    t.join();
                }
            } finally {
                if (store instanceof GroupCommitLedgerStore g) {
                    g.close();
                }
            }
            System.out.printf("writer done: acknowledged=%d failed(not acked)=%d%n", acked.get(), failed.get());
        }
    }

    private static int verify(String[] a) throws Exception {
        Set<String> acked = new HashSet<>(Files.readAllLines(Path.of(a[4])));
        try (HikariDataSource ds = pool(a[1], a[2], a[3], 2);
             Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement("SELECT batch_id FROM ledger_batch WHERE tenant = 'chaos'");
             ResultSet rs = ps.executeQuery()) {
            Set<String> present = new HashSet<>();
            while (rs.next()) {
                present.add(rs.getString(1));
            }
            Set<String> lost = new HashSet<>(acked);
            lost.removeAll(present);
            LedgerIntegrityCheck.Report rep = new LedgerIntegrityCheck(ds).run();
            System.out.printf("acknowledged=%d present=%d lost=%d unacknowledged-but-committed=%d%n", acked.size(),
                    present.size(), lost.size(), present.size() - (acked.size() - lost.size()));
            System.out.println("integrity: " + rep);
            boolean pass = lost.isEmpty() && rep.ok();
            System.out.println(pass ? "PASS: no acknowledged posting lost; ledger consistent" : "FAIL");
            return pass ? 0 : 1;
        }
    }
}
