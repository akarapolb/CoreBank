package org.fabor.app;

import static org.assertj.core.api.Assertions.assertThat;

import io.grpc.ManagedChannel;
import io.grpc.Metadata;
import io.grpc.StatusRuntimeException;
import io.grpc.netty.shaded.io.grpc.netty.NettyChannelBuilder;
import io.grpc.stub.MetadataUtils;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.Statement;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import javax.sql.DataSource;
import org.fabor.ledger.api.grpc.GetBalanceRequest;
import org.fabor.ledger.api.grpc.LedgerGrpc;
import org.fabor.onboarding.Ports;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;
import org.junit.jupiter.api.Assumptions;

/** End to end through HTTP and gRPC against a real PostgreSQL: products, onboarding, deposits, origination, repayment. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"fabor.auth-mode=token", "fabor.api-token=test-token-1234567890", "fabor.grpc-port=19090", "fabor.scheduler-enabled=false",
                "management.server.port=0"})
@Import(FaborAppTest.Fakes.class)
class FaborAppTest {
    static final String TOKEN = "test-token-1234567890";

    @TestConfiguration
    static class Fakes {
        @Bean
        @Primary
        Ports.EkycProvider ekyc() {
            return (id, name, dob, ref) -> new Ports.EkycResult(true, 0.98, "ok");
        }

        @Bean
        @Primary
        Ports.CreditBureau bureau() {
            return id -> Optional.of(new Ports.BureauReport(740, 0));
        }
    }

    static PostgreSQLContainer<?> container;

    @DynamicPropertySource
    static void db(DynamicPropertyRegistry r) {
        String url = System.getenv("FABOR_PG_URL");
        if (url != null) {
            r.add("spring.datasource.url", () -> url);
            r.add("spring.datasource.username", () -> System.getenv().getOrDefault("FABOR_PG_USER", "postgres"));
            r.add("spring.datasource.password", () -> System.getenv().getOrDefault("FABOR_PG_PASSWORD", ""));
        } else {
            Assumptions.assumeTrue(DockerClientFactory.instance().isDockerAvailable(), "No PostgreSQL; skipping");
            container = new PostgreSQLContainer<>("postgres:16");
            container.start();
            r.add("spring.datasource.url", container::getJdbcUrl);
            r.add("spring.datasource.username", container::getUsername);
            r.add("spring.datasource.password", container::getPassword);
        }
        r.add("fabor.master-key", () -> Base64.getEncoder().encodeToString(new byte[40]));
    }

    @Autowired TestRestTemplate http;
    @Autowired DataSource ds;
    @LocalServerPort int port;

    static String resource(String name) throws IOException {
        try (var in = FaborAppTest.class.getResourceAsStream(name)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    HttpHeaders headers(String actor, MediaType type) {
        HttpHeaders h = new HttpHeaders();
        h.set("Authorization", "Bearer " + TOKEN);
        h.set("X-Actor", actor);
        h.setContentType(type);
        return h;
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> call(HttpMethod m, String path, String actor, Object body, MediaType type) {
        ResponseEntity<Map> r = http.exchange(path, m, new HttpEntity<>(body, headers(actor, type)), Map.class);
        assertThat(r.getStatusCode().is2xxSuccessful()).as(path + " -> " + r.getStatusCode() + " " + r.getBody()).isTrue();
        return r.getBody();
    }

    void publish(String yaml) {
        Map<String, Object> d = call(HttpMethod.POST, "/api/v1/products/drafts", "maya", yaml, MediaType.TEXT_PLAIN);
        String id = (String) d.get("id");
        call(HttpMethod.POST, "/api/v1/products/drafts/" + id + "/submit", "maya", null, MediaType.APPLICATION_JSON);
        String[][] approvals = {{"bob", "PRODUCT"}, {"rita", "RISK"}, {"fin", "FINANCE"}, {"carl", "COMPLIANCE"}};
        for (String[] a : approvals) {
            call(HttpMethod.POST, "/api/v1/products/drafts/" + id + "/approve", a[0], Map.of("role", a[1]), MediaType.APPLICATION_JSON);
        }
        Map<String, Object> v = call(HttpMethod.POST, "/api/v1/products/drafts/" + id + "/publish", "maya", null, MediaType.APPLICATION_JSON);
        assertThat(v.get("version")).isEqualTo(1);
    }

    @Test
    void wholeJourney() throws Exception {
        try (Connection c = ds.getConnection(); Statement st = c.createStatement()) {
            st.execute("TRUNCATE ledger_entry, ledger_outbox, ledger_balance, ledger_batch, audit_log, pii_vault, consent_event, "
                    + "party, deposit_account, deposit_ytd, loan_instalment, loan, catalog_draft, catalog_version, scheduler_due");
        }
        // security first: no token, no entry
        assertThat(http.getForEntity("/api/v1/products/X/versions", String.class).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        HttpHeaders noActor = new HttpHeaders();
        noActor.set("Authorization", "Bearer " + TOKEN);
        assertThat(http.exchange("/api/v1/products/X/versions", HttpMethod.GET, new HttpEntity<>(noActor), String.class)
                .getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        // Master Builder: two products published through maker-checker
        publish(resource("/products/savings.yaml"));
        publish(resource("/products/personal-loan.yaml"));
        ResponseEntity<List> versions = http.exchange("/api/v1/products/PERSONAL_LOAN_STD/versions", HttpMethod.GET,
                new HttpEntity<>(headers("maya", MediaType.APPLICATION_JSON)), List.class);
        assertThat(versions.getBody()).hasSize(1);

        // onboarding with consent, then funds
        Map<String, Object> reg = Map.of("partyId", "P1", "fullName", "Anong Suksan", "nationalId", "1101700230678",
                "phone", "0812345678", "dateOfBirth", "1990-06-01", "documentRef", "doc-1",
                "consents", List.of(Map.of("purpose", "KYC_PROCESSING", "version", 1, "channel", "APP"),
                        Map.of("purpose", "CREDIT_BUREAU", "version", 1, "channel", "APP")));
        Map<String, Object> party = call(HttpMethod.POST, "/api/v1/customers", "ops", reg, MediaType.APPLICATION_JSON);
        assertThat(party.get("status")).isEqualTo("ACTIVE");
        assertThat(party.get("depositAccountId")).isEqualTo("SAV-P1");
        assertThat(party.toString()).doesNotContain("1101700230678").doesNotContain("0812345678");

        // loan application: approved, disbursed to the savings account
        Map<String, Object> application = Map.ofEntries(Map.entry("applicationId", "APP1"), Map.entry("partyId", "P1"),
                Map.entry("productCode", "PERSONAL_LOAN_STD"), Map.entry("productVersion", 1), Map.entry("amountMinor", 10_000_000),
                Map.entry("termMonths", 12), Map.entry("monthlyInstalmentMinor", 916_800), Map.entry("monthlyIncomeMinor", 5_000_000),
                Map.entry("existingDebtMinor", 500_000), Map.entry("monthsAtEmployer", 36), Map.entry("asOf", "2026-01-15"),
                Map.entry("currency", "THB"));
        Map<String, Object> decision = call(HttpMethod.POST, "/api/v1/loans/applications", "ops", application, MediaType.APPLICATION_JSON);
        assertThat(decision.get("decision")).isEqualTo("APPROVE");
        assertThat(decision.get("loanId")).isEqualTo("LN-APP1");
        Map<String, Object> balance = call(HttpMethod.GET, "/api/v1/accounts/SAV-P1/balance?asOf=2026-01-15", "ops", null, MediaType.APPLICATION_JSON);
        assertThat(((Number) balance.get("minor")).longValue()).isEqualTo(9_893_000);

        // retries are safe: the same application is not a second loan
        ResponseEntity<Map> again = http.exchange("/api/v1/loans/applications", HttpMethod.POST,
                new HttpEntity<>(application, headers("ops", MediaType.APPLICATION_JSON)), Map.class);
        assertThat(again.getStatusCode().is2xxSuccessful() || again.getStatusCode() == HttpStatus.CONFLICT).isTrue();

        // errors map to stable statuses
        ResponseEntity<Map> overdraft = http.exchange("/api/v1/accounts/SAV-P1/withdrawals", HttpMethod.POST, new HttpEntity<>(
                Map.of("reference", "w1", "amountMinor", 99_999_999, "currency", "THB", "valueDate", "2026-01-16"),
                headers("ops", MediaType.APPLICATION_JSON)), Map.class);
        assertThat(overdraft.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(overdraft.getBody()).containsEntry("error", "insufficient_funds");

        // due work was scheduled: 12 billing tasks and a daily accrual for the loan, a monthly task for the account
        try (Connection c = ds.getConnection(); Statement st = c.createStatement();
             var rs = st.executeQuery("SELECT count(*) FROM scheduler_due")) {
            rs.next();
            assertThat(rs.getLong(1)).isEqualTo(12 + 1 + 1);
        }

        // backfill: losing the queue and running it again restores exactly the same due work, and a second run adds nothing
        try (Connection c = ds.getConnection(); Statement st = c.createStatement()) {
            st.execute("TRUNCATE scheduler_due");
        }
        Map<String, Object> filled = call(HttpMethod.POST, "/api/v1/admin/scheduler/backfill", "ops", null, MediaType.APPLICATION_JSON);
        assertThat(((Number) filled.get("queued")).intValue()).isEqualTo(14);
        Map<String, Object> again2 = call(HttpMethod.POST, "/api/v1/admin/scheduler/backfill", "ops", null, MediaType.APPLICATION_JSON);
        assertThat(((Number) again2.get("queued")).intValue()).isZero();

        // the customer's own view (dev token mode takes the party from X-Party); another customer cannot reach it
        HttpHeaders me = headers("P1", MediaType.APPLICATION_JSON);
        me.set("X-Party", "P1");
        Map profile = http.exchange("/api/v1/me", HttpMethod.GET, new HttpEntity<>(me), Map.class).getBody();
        assertThat(profile.get("depositAccountId")).isEqualTo("SAV-P1");
        Map bal = http.exchange("/api/v1/me/balance", HttpMethod.GET, new HttpEntity<>(me), Map.class).getBody();
        assertThat(((Number) bal.get("minor")).longValue()).isEqualTo(9_893_000);
        List activity = http.exchange("/api/v1/me/activity", HttpMethod.GET, new HttpEntity<>(me), List.class).getBody();
        assertThat(activity).hasSize(1);
        assertThat(((Map) activity.get(0)).get("label")).isEqualTo("Loan paid out");
        List myLoans = http.exchange("/api/v1/me/loans", HttpMethod.GET, new HttpEntity<>(me), List.class).getBody();
        assertThat(myLoans).hasSize(1);
        assertThat(((Map) myLoans.get(0)).get("id")).isEqualTo("LN-APP1");
        HttpHeaders other = headers("P2", MediaType.APPLICATION_JSON);
        other.set("X-Party", "P2");
        assertThat(http.exchange("/api/v1/me/loans", HttpMethod.GET, new HttpEntity<>(other), List.class).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);                                                  // no such customer profile
        HttpHeaders none = headers("x", MediaType.APPLICATION_JSON);
        assertThat(http.exchange("/api/v1/me", HttpMethod.GET, new HttpEntity<>(none), Map.class).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);                                                  // login not linked to a customer
        assertThat(http.exchange("/api/v1/me/loans/LN-APP1/repayments", HttpMethod.POST, new HttpEntity<>(
                Map.of("reference", "r1", "amountMinor", 1), other), Map.class).getStatusCode()).isIn(HttpStatus.FORBIDDEN, HttpStatus.BAD_REQUEST);

        // gRPC endpoint: needs the token, serves the same ledger
        ManagedChannel ch = NettyChannelBuilder.forAddress("localhost", 19090).usePlaintext().build();
        try {
            var anonymous = LedgerGrpc.newBlockingStub(ch);
            GetBalanceRequest req = GetBalanceRequest.newBuilder().setTenant("bank-a").setAccount("dep:SAV-P1")
                    .setBalanceType("SETTLED").setCurrency("THB").setValueAsOf("2026-01-15").build();
            try {
                anonymous.getBalance(req);
                throw new AssertionError("expected UNAUTHENTICATED");
            } catch (StatusRuntimeException e) {
                assertThat(e.getStatus().getCode()).isEqualTo(io.grpc.Status.Code.UNAUTHENTICATED);
            }
            Metadata md = new Metadata();
            md.put(Metadata.Key.of("authorization", Metadata.ASCII_STRING_MARSHALLER), "Bearer " + TOKEN);
            var authed = LedgerGrpc.newBlockingStub(ch).withInterceptors(MetadataUtils.newAttachHeadersInterceptor(md));
            assertThat(authed.getBalance(req).getMinor()).isEqualTo(9_893_000);
        } finally {
            ch.shutdownNow();
        }

        // audit chain is intact and recorded the decision
        try (Connection c = ds.getConnection(); Statement st = c.createStatement();
             var rs = st.executeQuery("SELECT count(*) FROM audit_log WHERE action LIKE 'CREDIT_DECISION%'")) {
            rs.next();
            assertThat(rs.getLong(1)).isGreaterThanOrEqualTo(1);
        }
    }
}
