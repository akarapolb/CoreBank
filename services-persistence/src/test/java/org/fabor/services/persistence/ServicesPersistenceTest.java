package org.fabor.services.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.fabor.catalog.Draft;
import org.fabor.catalog.MasterBuilder;
import org.fabor.catalog.PublishedVersion;
import org.fabor.deposit.DepositAccount;
import org.fabor.engine.product.ThailandRetailRules;
import org.fabor.lending.Loan;
import org.fabor.onboarding.Party;
import org.fabor.platform.security.AuditLog;
import org.fabor.platform.security.ConsentRegistry;
import org.fabor.platform.security.KeyProvider;
import org.fabor.platform.security.PiiVault;
import org.fabor.platform.tenancy.TenantId;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.postgresql.ds.PGSimpleDataSource;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;

/** Repository behaviour on PostgreSQL (FABOR_PG_URL, or Testcontainers when Docker is present). */
class ServicesPersistenceTest {
    static final TenantId T = new TenantId("bank-a");
    static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");
    static PGSimpleDataSource ds;

    @BeforeAll
    static void migrate() {
        ds = new PGSimpleDataSource();
        String url = System.getenv("FABOR_PG_URL");
        if (url != null) {
            ds.setUrl(url);
            ds.setUser(System.getenv().getOrDefault("FABOR_PG_USER", "postgres"));
            ds.setPassword(System.getenv().getOrDefault("FABOR_PG_PASSWORD", ""));
        } else {
            Assumptions.assumeTrue(DockerClientFactory.instance().isDockerAvailable(), "No PostgreSQL; skipping");
            PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16");
            pg.start();
            ds.setUrl(pg.getJdbcUrl());
            ds.setUser(pg.getUsername());
            ds.setPassword(pg.getPassword());
        }
        Flyway.configure().dataSource(ds).locations("classpath:db/migration/services/postgresql").table("flyway_services")
                .baselineOnMigrate(true).baselineVersion("0").cleanDisabled(false).load().migrate();
    }

    @BeforeEach
    void clean() throws SQLException {
        try (Connection c = ds.getConnection(); Statement st = c.createStatement()) {
            st.execute("TRUNCATE audit_log, pii_vault, consent_event, party, deposit_account, deposit_ytd, loan_instalment, loan, "
                    + "catalog_draft, catalog_version");
        }
    }

    static KeyProvider keys(String[] current) {
        return new KeyProvider() {
            public String currentKeyId(TenantId t) { return current[0]; }
            public byte[] dataKey(TenantId t, String id) { byte[] k = new byte[32]; Arrays.fill(k, (byte) id.hashCode()); return k; }
            public byte[] indexKey(TenantId t) { byte[] k = new byte[32]; Arrays.fill(k, (byte) 5); return k; }
        };
    }

    @Test
    void auditChainSurvivesInTheDatabaseAndDetectsTamperingAndRefusesEdits() throws SQLException {
        AuditLog log = new AuditLog(new JdbcAuditStore(ds));
        log.append(T0, "HUMAN", "alice", null, "A", "s1", "d");
        log.append(T0.plusSeconds(1), "AGENT", "bot", "cust", "B", "s2", null);
        AuditLog reopened = new AuditLog(new JdbcAuditStore(ds));      // a different instance sees the same chain
        reopened.append(T0.plusSeconds(2), "SYSTEM", "sched", null, "C", "s3", "");
        assertThat(log.all()).hasSize(3);
        assertThat(log.verify().ok()).isTrue();
        assertThat(log.head().orElseThrow().seq()).isEqualTo(3);
        try (Connection c = ds.getConnection(); Statement st = c.createStatement()) {
            assertThatThrownBy(() -> st.execute("UPDATE audit_log SET actor = 'mallory' WHERE seq = 2")).hasMessageContaining("immutable");
            assertThatThrownBy(() -> st.execute("DELETE FROM audit_log WHERE seq = 1")).hasMessageContaining("immutable");
        }
    }

    @Test
    void concurrentAuditWritersNeverForkTheChain() throws Exception {
        AuditLog log = new AuditLog(new JdbcAuditStore(ds));
        Thread[] ts = new Thread[8];
        for (int t = 0; t < ts.length; t++) {
            int n = t;
            ts[t] = new Thread(() -> {
                for (int i = 0; i < 15; i++) {
                    log.append(T0.plusSeconds(i), "SYSTEM", "w" + n, null, "X", "s", "i" + i);
                }
            });
            ts[t].start();
        }
        for (Thread t : ts) {
            t.join();
        }
        assertThat(log.all()).hasSize(120);
        assertThat(log.verify().ok()).isTrue();
    }

    @Test
    void vaultStoresOnlyCiphertextRotatesAndDeduplicates() {
        String[] current = {"k1"};
        PiiVault v = new PiiVault(keys(current), Set.of("P"), (t, tok, p, a) -> { }, new JdbcVaultStore(ds));
        String tok = v.tokenize(T, "phone", "0812345678");
        assertThat(v.tokenize(T, "phone", "0812345678")).isEqualTo(tok);
        assertThat(new PiiVault(keys(current), Set.of("P"), (t, x, p, a) -> { }, new JdbcVaultStore(ds))
                .detokenize(T, tok, "P", "x")).contains("0812345678");
        assertThat(v.storedForm(T, tok)).doesNotContain("0812345678");
        assertThat(v.lookup(T, "phone", "0812345678")).contains(tok);
        current[0] = "k2";
        assertThat(v.rotate(T)).isEqualTo(1);
        assertThat(v.storedForm(T, tok)).startsWith("k2:");
        assertThat(v.detokenize(T, tok, "P", "x")).contains("0812345678");
        assertThat(v.detokenize(T, "tok_nope", "P", "x")).isEmpty();
    }

    @Test
    void concurrentTokenizationOfOneValueYieldsOneToken() throws Exception {
        PiiVault v = new PiiVault(keys(new String[] {"k1"}), Set.of("P"), (t, tok, p, a) -> { }, new JdbcVaultStore(ds));
        String[] tokens = new String[8];
        Thread[] ts = new Thread[8];
        for (int i = 0; i < 8; i++) {
            int n = i;
            ts[i] = new Thread(() -> tokens[n] = v.tokenize(T, "national_id", "1101700230678"));
            ts[i].start();
        }
        for (Thread t : ts) {
            t.join();
        }
        assertThat(Arrays.stream(tokens).distinct()).hasSize(1);
    }

    @Test
    void consentHistoryIsOrderedAndWithdrawable() {
        ConsentRegistry c = new ConsentRegistry(new JdbcConsentStore(ds));
        c.grant(T, "p1", "CREDIT_BUREAU", 1, T0, "APP");
        c.grant(T, "p1", "MARKETING", 2, T0.plusSeconds(5), "APP");
        c.withdraw(T, "p1", "MARKETING", T0.plusSeconds(10), "APP");
        assertThat(c.isGranted(T, "p1", "CREDIT_BUREAU", 1, T0.plusSeconds(1))).isTrue();
        assertThat(c.isGranted(T, "p1", "MARKETING", 1, T0.plusSeconds(7))).isTrue();
        assertThat(c.isGranted(T, "p1", "MARKETING", 1, T0.plusSeconds(11))).isFalse();
        assertThat(c.current(T, "p1", T0.plusSeconds(20))).containsOnlyKeys("CREDIT_BUREAU");
        assertThat(c.history(T, "p1", "MARKETING")).hasSize(2);
        assertThatThrownBy(() -> c.grant(T, "p1", "MARKETING", 2, T0, "APP")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void partyDepositAndLoanRoundTrip() {
        var parties = new JdbcPartyRepo(ds, T);
        Party p = new Party("P1", "tn", "ti", "tp", LocalDate.of(1990, 6, 1), Party.Status.UNDER_REVIEW, null);
        parties.save(p);
        assertThat(parties.find("P1")).contains(p);
        parties.save(p.with(Party.Status.ACTIVE, "SAV-P1"));
        assertThat(parties.find("P1").orElseThrow().status()).isEqualTo(Party.Status.ACTIVE);
        assertThat(parties.find("none")).isEmpty();
        assertThat(new JdbcPartyRepo(ds, new TenantId("bank-b")).find("P1")).isEmpty();

        var deposits = new JdbcDepositRepo(ds, T);
        DepositAccount a = new DepositAccount("SAV-P1", "P1", "SAVINGS_TIERED", 1, "THB");
        deposits.save(a);
        deposits.save(a);
        assertThat(deposits.find("SAV-P1")).contains(a);
        assertThat(deposits.find("x")).isEmpty();
        assertThat(deposits.accountIds()).containsExactly("SAV-P1");
        assertThat(deposits.yearToDate("SAV-P1", 2026).grossInterest()).isZero();
        deposits.addYearToDate("SAV-P1", 2026, 100, 15);
        deposits.addYearToDate("SAV-P1", 2026, 50, 0);
        assertThat(deposits.yearToDate("SAV-P1", 2026)).isEqualTo(new org.fabor.deposit.DepositRepo.YearToDate(150, 15));

        var loans = new JdbcLoanRepo(ds, T);
        Loan l = new Loan("L1", "P1", "PERSONAL_LOAN_STD", 1, "THB", "SAV-P1", LocalDate.of(2026, 1, 15), 1_000_000,
                List.of(new Loan.Instalment(1, LocalDate.of(2026, 2, 16), 80_000, 15_000, 0, 0, 0, 0, false),
                        new Loan.Instalment(2, LocalDate.of(2026, 3, 16), 81_000, 14_000, 0, 0, 0, 0, false)), Loan.Status.ACTIVE);
        loans.save(l);
        assertThat(loans.find("L1")).contains(l);
        Loan paid = l.withInstalments(List.of(new Loan.Instalment(1, LocalDate.of(2026, 2, 16), 80_000, 15_000, 80_000, 15_000, 300, 300, true),
                l.instalments().get(1)), Loan.Status.NON_ACCRUAL);
        loans.save(paid);
        assertThat(loans.find("L1")).contains(paid);
        // VAT billed on an instalment, partly paid, survives a round trip
        Loan withVat = paid.withInstalments(List.of(paid.instalments().get(0), new Loan.Instalment(2, LocalDate.of(2026, 3, 16),
                81_000, 14_000, 0, 0, 0, 0, true, 980, 400)), Loan.Status.NON_ACCRUAL);
        loans.save(withVat);
        assertThat(loans.find("L1")).contains(withVat);
        assertThat(loans.find("L1").orElseThrow().instalments().get(1).vatOutstanding()).isEqualTo(580);
        loans.save(paid);
        // a restructuring replaces the rate and can shorten the schedule: old rows beyond the new length are removed
        Loan restructured = paid.withRate(new java.math.BigDecimal("0.090000")).withInstalments(
                List.of(new Loan.Instalment(1, LocalDate.of(2026, 5, 15), 70_000, 6_000, 0, 0, 0, 0, false)), Loan.Status.ACTIVE);
        loans.save(restructured);
        Loan back = loans.find("L1").orElseThrow();
        assertThat(back.instalments()).hasSize(1);
        assertThat(back.rateOverride()).isEqualByComparingTo("0.09");
        assertThat(back.generation()).isEqualTo(1);
        assertThat(back.tag()).isEqualTo("g1-");
        assertThat(loans.find("zz")).isEmpty();
        assertThat(loans.idsByParty("P1")).containsExactly("L1");
        assertThat(loans.idsByParty("nobody")).isEmpty();
        assertThat(loans.activeIds()).containsExactly("L1");
        loans.save(restructured.withStatus(Loan.Status.WRITTEN_OFF));
        assertThat(loans.activeIds()).isEmpty();
    }

    @Test
    void leaseRoundTripAndAccrualState() {
        var leases = new JdbcLeaseRepo(ds, T);
        assertThat(leases.find("LS1")).isEmpty();
        org.fabor.lending.Lease lease = new org.fabor.lending.Lease("LS1", "P-LEASE", org.fabor.lending.Lease.Kind.OPERATING, "THB",
                "SAV-P1", LocalDate.of(2026, 1, 15), 6_000_000, 3_000_000, List.of(
                        new org.fabor.lending.Lease.Period(1, LocalDate.of(2026, 2, 16), 0, 0, 483_334, 500_000, false, 0),
                        new org.fabor.lending.Lease.Period(2, LocalDate.of(2026, 3, 16), 500_000, 0, 483_333, 500_000, false, 0)),
                org.fabor.lending.Lease.Status.ACTIVE);
        leases.save(lease);
        assertThat(leases.find("LS1")).contains(lease);
        // accrual and a partial collection change only the state columns
        org.fabor.lending.Lease accrued = lease.withPeriods(List.of(
                new org.fabor.lending.Lease.Period(1, LocalDate.of(2026, 2, 16), 0, 0, 483_334, 500_000, true, 0),
                new org.fabor.lending.Lease.Period(2, LocalDate.of(2026, 3, 16), 500_000, 0, 483_333, 500_000, true, 200_000)),
                org.fabor.lending.Lease.Status.ACTIVE);
        leases.save(accrued);
        assertThat(leases.find("LS1")).contains(accrued);
        assertThat(leases.find("LS1").orElseThrow().periods().get(1).outstanding()).isEqualTo(300_000);
        leases.save(accrued.withPeriods(accrued.periods(), org.fabor.lending.Lease.Status.COMPLETED));
        assertThat(leases.find("LS1").orElseThrow().status()).isEqualTo(org.fabor.lending.Lease.Status.COMPLETED);
        assertThat(leases.idsByParty("P-LEASE")).containsExactly("LS1");
        assertThat(leases.idsByParty("nobody")).isEmpty();
    }

    @Test
    void masterBuilderRunsEndToEndOnTheDatabaseCatalog() throws IOException {
        var store = new JdbcCatalogStore(ds);
        MasterBuilder mb = new MasterBuilder(store, List.of(new ThailandRetailRules()), Set.of("PRODUCT", "RISK"),
                Clock.fixed(T0, ZoneOffset.UTC));
        String yaml;
        try (var in = getClass().getResourceAsStream("/personal-loan.yaml")) {
            yaml = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
        Draft d = mb.createDraft("maya", yaml);
        mb.submit(d.id(), "maya");
        assertThat(store.openDrafts()).extracting(Draft::id).containsExactly(d.id());
        mb.approve(d.id(), "bob", "PRODUCT");
        assertThat(store.draft(d.id()).orElseThrow().approvals()).containsEntry("PRODUCT", "bob");
        mb.approve(d.id(), "rita", "RISK");
        PublishedVersion v = mb.publish(d.id(), "maya");
        assertThat(store.openDrafts()).isEmpty();
        assertThat(store.version("PERSONAL_LOAN_STD", 1)).contains(v);
        assertThat(store.versions("PERSONAL_LOAN_STD")).hasSize(1);
        assertThatThrownBy(() -> store.publish(v)).isInstanceOf(IllegalStateException.class).hasMessageContaining("already published");
        mb.retire("PERSONAL_LOAN_STD", 1);
        assertThat(store.version("PERSONAL_LOAN_STD", 1).orElseThrow().retired()).isTrue();
        assertThat(store.draft("none")).isEmpty();
        assertThat(JdbcCatalogStore.decode("a=b\nc=d\n")).containsEntry("a", "b").containsEntry("c", "d");
    }
}
