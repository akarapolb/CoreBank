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
    @Autowired org.springframework.context.ApplicationContext context;
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
                    + "party, deposit_account, deposit_ytd, loan_instalment, loan, catalog_draft, catalog_version, scheduler_due, "
                    + "asset_title_event, asset_policy, asset, dealer, lease_period, lease, collection_event, repossession, "
                    + "fp_unit, fp_curtailment, fp_unit_terms, fp_line, master_schedule, master_rate_card, master_agreement");
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
        // staff views for the console: a customer with contracts, one contract in full, the postings of an account
        Map<String, Object> cust = call(HttpMethod.GET, "/api/v1/customers/P1", "ops", null, MediaType.APPLICATION_JSON);
        assertThat(cust.get("depositAccountId")).isEqualTo("SAV-P1");
        assertThat((List<?>) cust.get("loans")).hasSize(1);
        assertThat(cust.toString()).doesNotContain("Anong").doesNotContain("1101700230678");
        Map<String, Object> detail = call(HttpMethod.GET, "/api/v1/loans/LN-APP1/detail?asOf=2026-01-15", "ops", null, MediaType.APPLICATION_JSON);
        assertThat((List<?>) detail.get("instalments")).hasSize(12);
        assertThat(((Number) detail.get("outstandingMinor")).longValue()).isEqualTo(10_000_000L);
        assertThat(call(HttpMethod.GET, "/api/v1/loans/LN-APP1/detail", "ops", null, MediaType.APPLICATION_JSON).get("status")).isEqualTo("ACTIVE");

        // loss allowance: the model parameters are not configured in tests, so neither the run nor the preview may start
        ResponseEntity<Map> noModel = http.exchange("/api/v1/ecl/run?asOf=2026-02-01", HttpMethod.POST,
                new HttpEntity<>(headers("ops", MediaType.APPLICATION_JSON)), Map.class);
        assertThat(noModel.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(String.valueOf(noModel.getBody().get("message"))).contains("fabor.ecl.annual-pd");
        assertThat(http.exchange("/api/v1/ecl/loans/LN-APP1", HttpMethod.GET,
                new HttpEntity<>(headers("ops", MediaType.APPLICATION_JSON)), Map.class).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);

        // loan list for the console: search, status and overdue filters
        assertThat(http.exchange("/api/v1/loans?q=app1", HttpMethod.GET, new HttpEntity<>(headers("ops", MediaType.APPLICATION_JSON)),
                List.class).getBody()).hasSize(1);
        assertThat(http.exchange("/api/v1/loans?q=nobody", HttpMethod.GET, new HttpEntity<>(headers("ops", MediaType.APPLICATION_JSON)),
                List.class).getBody()).isEmpty();
        assertThat(http.exchange("/api/v1/loans?status=CLOSED", HttpMethod.GET, new HttpEntity<>(headers("ops", MediaType.APPLICATION_JSON)),
                List.class).getBody()).isEmpty();
        Map<?, ?> row = (Map<?, ?>) http.exchange("/api/v1/loans", HttpMethod.GET, new HttpEntity<>(headers("ops", MediaType.APPLICATION_JSON)),
                List.class).getBody().get(0);
        assertThat(row.get("id")).isEqualTo("LN-APP1");
        assertThat(((Number) row.get("outstandingMinor")).longValue()).isEqualTo(10_000_000L);
        // a settlement quote without settling: the remaining principal on the day of disbursement (no interest yet due)
        Map<String, Object> quote = call(HttpMethod.GET, "/api/v1/loans/LN-APP1/settlement-quote?date=2026-01-15", "ops", null,
                MediaType.APPLICATION_JSON);
        assertThat(((Number) quote.get("amountMinor")).longValue()).isEqualTo(10_000_000L);
        // the OpenAPI document names schemas by simple class name, so two request or view records with the same name would
        // silently share one schema and give the generated client the wrong shape for one of them
        java.util.Map<String, Long> names = context.getBeansWithAnnotation(org.springframework.web.bind.annotation.RestController.class)
                .values().stream().flatMap(b -> java.util.Arrays.stream(org.springframework.aop.support.AopUtils.getTargetClass(b).getDeclaredClasses()))
                .filter(Class::isRecord).collect(java.util.stream.Collectors.groupingBy(Class::getSimpleName, java.util.stream.Collectors.counting()));
        assertThat(names.entrySet().stream().filter(e -> e.getValue() > 1).map(java.util.Map.Entry::getKey)).isEmpty();
        // the OpenAPI document the console client is generated from: behind sign-in, and the caller is not a parameter
        assertThat(http.getForEntity("/api/v1/openapi", String.class).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        String openapi = http.exchange("/api/v1/openapi", HttpMethod.GET, new HttpEntity<>(headers("ops", MediaType.APPLICATION_JSON)),
                String.class).getBody();
        assertThat(openapi).contains("\"/api/v1/loans\"").contains("\"/api/v1/collections/queue\"").doesNotContain("\"actor\"");

        // the console overview: totals read from the services (one account and one 100,000.00 loan so far, nothing overdue)
        Map<String, Object> overview = call(HttpMethod.GET, "/api/v1/overview?asOf=2026-01-20", "ops", null, MediaType.APPLICATION_JSON);
        assertThat(((Number) overview.get("depositAccounts")).longValue()).isEqualTo(1L);
        assertThat(((Number) overview.get("depositsMinor")).longValue()).isEqualTo(9_893_000L);
        assertThat(((Number) overview.get("activeLoans")).longValue()).isEqualTo(1L);
        assertThat(((Number) overview.get("loansOutstandingMinor")).longValue()).isEqualTo(10_000_000L);
        assertThat(((Number) overview.get("nplRatio")).doubleValue()).isZero();
        assertThat(((Number) overview.get("overdueLoans")).longValue()).isZero();
        assertThat(((Number) overview.get("lossAllowanceMinor")).longValue()).isZero();

        // asset register: order, deliver, insure and put the vehicle under the loan; refusals map to stable statuses
        Map<String, Object> ordered = call(HttpMethod.POST, "/api/v1/assets", "ops", Map.of("id", "A1", "kind", "VEHICLE",
                "make", "Isuzu", "model", "D-Max", "serialNo", " mpav1234567890 ", "dealerId", "DLR-1", "costMinor", 12_000_000,
                "currency", "THB", "location", "Showroom"), MediaType.APPLICATION_JSON);
        assertThat(ordered.get("serialNo")).isEqualTo("MPAV1234567890");
        assertThat(ordered.get("status")).isEqualTo("ORDERED");
        ResponseEntity<Map> dupe = http.exchange("/api/v1/assets", HttpMethod.POST, new HttpEntity<>(Map.of("id", "A2", "kind",
                "VEHICLE", "make", "Isuzu", "model", "D-Max", "serialNo", "MPAV1234567890", "dealerId", "DLR-1", "costMinor", 1,
                "location", "x"), headers("ops", MediaType.APPLICATION_JSON)), Map.class);
        assertThat(dupe.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        call(HttpMethod.POST, "/api/v1/assets/A1/delivery", "ops", Map.of("registrationNo", "1AB 1234", "engineNo", "ENG-1",
                "date", "2026-01-16"), MediaType.APPLICATION_JSON);
        ResponseEntity<Map> uninsured = http.exchange("/api/v1/assets/A1/activation", HttpMethod.POST, new HttpEntity<>(Map.of(
                "contractId", "LN-APP1", "date", "2026-01-17", "insuranceRequired", true),
                headers("ops", MediaType.APPLICATION_JSON)), Map.class);
        assertThat(uninsured.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        call(HttpMethod.POST, "/api/v1/assets/A1/policies", "ops", Map.of("insurer", "Viriyah", "policyNo", "P-1", "from",
                "2026-01-01", "to", "2026-12-31", "sumInsuredMinor", 12_000_000, "premiumMinor", 150_000, "financed", false),
                MediaType.APPLICATION_JSON);
        Map<String, Object> active = call(HttpMethod.POST, "/api/v1/assets/A1/activation", "ops", Map.of("contractId", "LN-APP1",
                "date", "2026-01-17", "insuranceRequired", true), MediaType.APPLICATION_JSON);
        assertThat(active.get("status")).isEqualTo("ACTIVE");
        assertThat(active.get("contractId")).isEqualTo("LN-APP1");
        assertThat(call(HttpMethod.GET, "/api/v1/assets/A1/coverage?day=2026-06-01", "ops", null, MediaType.APPLICATION_JSON)
                .get("covered")).isEqualTo(true);
        assertThat(call(HttpMethod.GET, "/api/v1/assets/A1/coverage?day=2027-06-01", "ops", null, MediaType.APPLICATION_JSON)
                .get("covered")).isEqualTo(false);
        assertThat(http.exchange("/api/v1/assets/contract/LN-APP1", HttpMethod.GET,
                new HttpEntity<>(headers("ops", MediaType.APPLICATION_JSON)), List.class).getBody()).hasSize(1);
        ResponseEntity<Map> early = http.exchange("/api/v1/assets/A1/title-transfer", HttpMethod.POST, new HttpEntity<>(Map.of(
                "date", "2026-01-18", "reference", "t1"), headers("ops", MediaType.APPLICATION_JSON)), Map.class);
        assertThat(early.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);                  // the loan is not paid off
        assertThat(http.exchange("/api/v1/assets/NOPE", HttpMethod.GET, new HttpEntity<>(headers("ops", MediaType.APPLICATION_JSON)),
                Map.class).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        ResponseEntity<List> posted = http.exchange("/api/v1/ledger/batches?account=dep:SAV-P1&limit=5", HttpMethod.GET,
                new HttpEntity<>(headers("ops", MediaType.APPLICATION_JSON)), List.class);
        assertThat(posted.getBody()).hasSize(1);
        Map firstBatch = (Map) posted.getBody().get(0);
        assertThat(firstBatch.get("reason")).isEqualTo("Loan paid out");
        assertThat(firstBatch.get("origin")).isEqualTo("SYSTEM");
        assertThat((List<?>) firstBatch.get("legs")).hasSize(4);                       // principal, deposit, fee income, VAT
        assertThat(StaffViewController.origin("SAV-P1:dep-teller-1")).isEqualTo("HUMAN");
        assertThat(http.exchange("/api/v1/customers/NOPE", HttpMethod.GET, new HttpEntity<>(headers("ops", MediaType.APPLICATION_JSON)), Map.class)
                .getStatusCode().is4xxClientError()).isTrue();
        List<?> openDrafts = http.exchange("/api/v1/products/drafts", HttpMethod.GET, new HttpEntity<>(headers("maya", MediaType.APPLICATION_JSON)), List.class).getBody();
        assertThat(openDrafts).isEmpty();                                                          // both products are published
        HttpHeaders other = headers("P2", MediaType.APPLICATION_JSON);
        other.set("X-Party", "P2");
        ResponseEntity<List> othersLoans = http.exchange("/api/v1/me/loans", HttpMethod.GET, new HttpEntity<>(other), List.class);
        assertThat(othersLoans.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(othersLoans.getBody()).isEmpty();                                              // sees none of P1's loans
        assertThat(http.exchange("/api/v1/me", HttpMethod.GET, new HttpEntity<>(other), Map.class).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);                                                  // and has no profile
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

        // dealer channel: onboard, pay for the active asset (cost plus 2% commission), a second payment is refused
        call(HttpMethod.POST, "/api/v1/dealers", "ops", Map.of("id", "DLR-1", "name", "Bangna Motors", "taxId", "0105551234567",
                "commissionRate", 0.02), MediaType.APPLICATION_JSON);
        Map<String, Object> paid = call(HttpMethod.POST, "/api/v1/dealers/payments", "ops", Map.of("assetId", "A1",
                "date", "2026-01-18"), MediaType.APPLICATION_JSON);
        assertThat(((Number) paid.get("paidMinor")).longValue()).isEqualTo(12_240_000L);
        assertThat(http.exchange("/api/v1/dealers/payments", HttpMethod.POST, new HttpEntity<>(Map.of("assetId", "A1",
                "date", "2026-01-19"), headers("ops", MediaType.APPLICATION_JSON)), Map.class).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
        assertThat(call(HttpMethod.POST, "/api/v1/dealers/DLR-1/suspension", "ops", null, MediaType.APPLICATION_JSON).get("status"))
                .isEqualTo("SUSPENDED");

        // leases: book a finance lease, accrue and collect, check what it carries, end it early; refusals are stable
        Map<String, Object> lease = call(HttpMethod.POST, "/api/v1/leases/finance", "ops", Map.ofEntries(Map.entry("id", "F1"),
                Map.entry("party", "P1"), Map.entry("depositAccountId", "SAV-P1"), Map.entry("fairValueMinor", 5_000_000),
                Map.entry("directCostsMinor", 0), Map.entry("paymentMinor", 150_000), Map.entry("periods", 36),
                Map.entry("residualMinor", 1_000_000), Map.entry("start", "2026-01-15"), Map.entry("frequency", "MONTHLY")),
                MediaType.APPLICATION_JSON);
        assertThat(lease.get("kind")).isEqualTo("FINANCE");
        assertThat((List<?>) lease.get("periods")).hasSize(36);
        assertThat(http.exchange("/api/v1/leases/finance", HttpMethod.POST, new HttpEntity<>(Map.of("id", "F1", "party", "P1",
                "depositAccountId", "SAV-P1", "fairValueMinor", 1, "paymentMinor", 1, "periods", 1, "residualMinor", 0,
                "start", "2026-01-15"), headers("ops", MediaType.APPLICATION_JSON)), Map.class).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
        call(HttpMethod.POST, "/api/v1/leases/F1/accrual/1?asOf=2026-02-16", "ops", null, MediaType.APPLICATION_JSON);
        assertThat(http.exchange("/api/v1/leases/F1/accrual/3?asOf=2026-04-16", HttpMethod.POST,
                new HttpEntity<>(headers("ops", MediaType.APPLICATION_JSON)), Map.class).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        call(HttpMethod.POST, "/api/v1/leases/F1/collections", "ops", Map.of("reference", "c1", "amountMinor", 150_000,
                "date", "2026-02-16"), MediaType.APPLICATION_JSON);
        assertThat(((Number) call(HttpMethod.GET, "/api/v1/leases/F1/due", "ops", null, MediaType.APPLICATION_JSON).get("dueMinor"))
                .longValue()).isZero();
        long carried = ((Number) call(HttpMethod.GET, "/api/v1/leases/F1/carrying?date=2026-02-16", "ops", null,
                MediaType.APPLICATION_JSON).get("carryingMinor")).longValue();
        assertThat(carried).isGreaterThan(1_000_000L);
        Map<String, Object> ended = call(HttpMethod.POST, "/api/v1/leases/F1/termination", "ops", Map.of("reference", "t1",
                "feeMinor", 0, "date", "2026-02-16"), MediaType.APPLICATION_JSON);
        assertThat(ended.get("status")).isEqualTo("TERMINATED");
        assertThat(http.exchange("/api/v1/leases/NOPE", HttpMethod.GET, new HttpEntity<>(headers("ops", MediaType.APPLICATION_JSON)),
                Map.class).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        // floor plan: a dealer line, a drawdown per unit, limits, interest, sale, payoff and the stock audit
        Map<String, Object> line = call(HttpMethod.POST, "/api/v1/floorplans", "ops", Map.of("id", "FP-1", "dealerId", "DLR-1",
                "currency", "THB", "limitMinor", 100_000_000, "annualRate", 0.09, "payoffWindowDays", 2, "settlementAccountId",
                "SAV-P1", "terms", Map.of("NEW", Map.of("subLimitMinor", 80_000_000, "interestFreeDays", 60), "USED",
                        Map.of("subLimitMinor", 4_000_000, "interestFreeDays", 0)),
                "curtailments", List.of(Map.of("atDay", 120, "cumulativePercent", 10)), "signedOn", "2026-01-15"),
                MediaType.APPLICATION_JSON);
        assertThat(line.get("status")).isEqualTo("ACTIVE");
        assertThat(http.exchange("/api/v1/floorplans", HttpMethod.GET, new HttpEntity<>(headers("ops", MediaType.APPLICATION_JSON)),
                List.class).getBody()).hasSize(1);
        call(HttpMethod.POST, "/api/v1/floorplans/FP-1/units", "ops", Map.of("unitId", "VIN1", "type", "NEW", "amountMinor",
                1_000_000, "date", "2026-01-15", "supplierAccountId", "SAV-P1"), MediaType.APPLICATION_JSON);
        call(HttpMethod.POST, "/api/v1/floorplans/FP-1/units", "ops", Map.of("unitId", "VIN2", "type", "USED", "amountMinor",
                3_000_000, "date", "2026-01-15", "supplierAccountId", "SAV-P1"), MediaType.APPLICATION_JSON);
        assertThat(http.exchange("/api/v1/floorplans/FP-1/units", HttpMethod.POST, new HttpEntity<>(Map.of("unitId", "VIN3",
                "type", "USED", "amountMinor", 2_000_000, "date", "2026-01-15", "supplierAccountId", "SAV-P1"),
                headers("ops", MediaType.APPLICATION_JSON)), Map.class).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);   // USED sub-limit
        Map<String, Object> accrued = call(HttpMethod.POST, "/api/v1/floorplans/FP-1/units/VIN1/accrual?upTo=2026-04-15", "ops",
                null, MediaType.APPLICATION_JSON);
        assertThat(((Number) accrued.get("subvention")).longValue()).isPositive();             // the manufacturer bears the free days
        assertThat(((Number) call(HttpMethod.GET, "/api/v1/floorplans/FP-1/exposure", "ops", null, MediaType.APPLICATION_JSON)
                .get("exposureMinor")).longValue()).isEqualTo(4_000_000L);
        call(HttpMethod.POST, "/api/v1/floorplans/FP-1/units/VIN1/sale", "ops", Map.of("soldOn", "2026-04-20"), MediaType.APPLICATION_JSON);
        assertThat(http.exchange("/api/v1/floorplans/FP-1/overdue-sales?asOf=2026-04-25", HttpMethod.GET,
                new HttpEntity<>(headers("ops", MediaType.APPLICATION_JSON)), List.class).getBody()).hasSize(1);
        Map<String, Object> paidOff = call(HttpMethod.POST, "/api/v1/floorplans/FP-1/units/VIN1/payoff", "ops",
                Map.of("reference", "po1", "date", "2026-04-26"), MediaType.APPLICATION_JSON);
        assertThat(paidOff.get("status")).isEqualTo("PAID");
        assertThat(http.exchange("/api/v1/floorplans/FP-1/units", HttpMethod.GET,
                new HttpEntity<>(headers("ops", MediaType.APPLICATION_JSON)), List.class).getBody()).hasSize(2);          // paid ones too
        Map<String, Object> audit = call(HttpMethod.POST, "/api/v1/floorplans/FP-1/stock-audit", "ops",
                Map.of("asOf", "2026-05-01", "found", List.of("VIN9")), MediaType.APPLICATION_JSON);
        assertThat(audit.get("missing")).isEqualTo(List.of("VIN2"));
        assertThat(audit.get("unexpected")).isEqualTo(List.of("VIN9"));
        assertThat(audit.get("clean")).isEqualTo(false);
        call(HttpMethod.POST, "/api/v1/floorplans/FP-1/freeze", "ops", null, MediaType.APPLICATION_JSON);
        assertThat(http.exchange("/api/v1/floorplans/FP-1/units", HttpMethod.POST, new HttpEntity<>(Map.of("unitId", "VIN4",
                "type", "NEW", "amountMinor", 1_000, "date", "2026-05-02", "supplierAccountId", "SAV-P1"),
                headers("ops", MediaType.APPLICATION_JSON)), Map.class).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);   // frozen

        // fleet master agreement: rate card, a rate-locked call-off against the facility, headroom and refusals
        call(HttpMethod.POST, "/api/v1/masters", "ops", Map.of("id", "MA-1", "party", "P1", "currency", "THB", "limitMinor",
                20_000_000, "productCode", "PERSONAL_LOAN_STD", "productVersion", 1, "crossDefaultDpd", 60, "rateCard", List.of(
                        Map.of("vehicleClass", "TRUCK", "minTerm", 6, "maxTerm", 36, "rate", 0.05, "validFrom", "2026-01-01")),
                "date", "2026-06-01"), MediaType.APPLICATION_JSON);
        Map<String, Object> callOff = call(HttpMethod.POST, "/api/v1/masters/MA-1/call-offs", "ops", Map.of("loanId", "MS-1",
                "vehicleClass", "TRUCK", "assetIds", List.of("A1"), "principalMinor", 5_000_000, "term", 12, "date", "2026-06-15",
                "customerAccountId", "SAV-P1", "payoutAccountId", "SAV-P1"), MediaType.APPLICATION_JSON);
        assertThat(callOff.get("id")).isEqualTo("MS-1");
        try (Connection c = ds.getConnection(); Statement st = c.createStatement();
             var rs = st.executeQuery("SELECT count(*) FROM scheduler_due WHERE task_key LIKE 'bill:MS-1:%' OR task_key = 'accrue:MS-1'")) {
            rs.next();
            assertThat(rs.getLong(1)).isEqualTo(12 + 1);          // a call-off is billed and accrued like any loan
        }
        call(HttpMethod.POST, "/api/v1/masters/MA-1/call-offs", "ops", Map.of("loanId", "MS-1", "vehicleClass", "TRUCK", "assetIds",
                List.of("A1"), "principalMinor", 5_000_000, "term", 12, "date", "2026-06-15", "customerAccountId", "SAV-P1",
                "payoutAccountId", "SAV-P1"), MediaType.APPLICATION_JSON);                                                    // retry
        try (Connection c = ds.getConnection(); Statement st = c.createStatement();
             var rs = st.executeQuery("SELECT count(*) FROM scheduler_due WHERE task_key LIKE 'bill:MS-1:%' OR task_key = 'accrue:MS-1'")) {
            rs.next();
            assertThat(rs.getLong(1)).isEqualTo(12 + 1);          // keyed tasks: the retry queued nothing more
        }
        assertThat(http.exchange("/api/v1/masters/MA-1/schedules", HttpMethod.GET,
                new HttpEntity<>(headers("ops", MediaType.APPLICATION_JSON)), List.class).getBody()).hasSize(1);
        Map<String, Object> facility = call(HttpMethod.GET, "/api/v1/masters/MA-1/facility", "ops", null, MediaType.APPLICATION_JSON);
        assertThat(((Number) facility.get("utilisationMinor")).longValue()).isEqualTo(5_000_000L);
        assertThat(((Number) facility.get("headroomMinor")).longValue()).isEqualTo(15_000_000L);
        assertThat(http.exchange("/api/v1/masters/MA-1/call-offs", HttpMethod.POST, new HttpEntity<>(Map.of("loanId", "MS-2",
                "vehicleClass", "TRUCK", "assetIds", List.of(), "principalMinor", 16_000_000, "term", 12, "date", "2026-06-15",
                "customerAccountId", "SAV-P1", "payoutAccountId", "SAV-P1"), headers("ops", MediaType.APPLICATION_JSON)), Map.class)
                .getStatusCode()).isEqualTo(HttpStatus.CONFLICT);                                                        // beyond headroom
        assertThat(http.exchange("/api/v1/masters/MA-1/call-offs", HttpMethod.POST, new HttpEntity<>(Map.of("loanId", "MS-3",
                "vehicleClass", "BUS", "assetIds", List.of(), "principalMinor", 1_000_000, "term", 12, "date", "2026-06-15",
                "customerAccountId", "SAV-P1", "payoutAccountId", "SAV-P1"), headers("ops", MediaType.APPLICATION_JSON)), Map.class)
                .getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);                                                      // no rate card row
        assertThat(call(HttpMethod.POST, "/api/v1/masters/MA-1/evaluation?asOf=2026-09-20", "ops", null, MediaType.APPLICATION_JSON)
                .get("status")).isEqualTo("ACTIVE");
    }
}
