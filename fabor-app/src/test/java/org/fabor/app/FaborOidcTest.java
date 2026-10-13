package org.fabor.app;

import static org.assertj.core.api.Assertions.assertThat;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import io.grpc.ManagedChannel;
import io.grpc.Metadata;
import io.grpc.StatusRuntimeException;
import io.grpc.netty.shaded.io.grpc.netty.NettyChannelBuilder;
import io.grpc.stub.MetadataUtils;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.sql.Connection;
import java.sql.Statement;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.fabor.ledger.api.grpc.GetBalanceRequest;
import org.fabor.ledger.api.grpc.LedgerGrpc;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;

/** OIDC mode: signed JWTs from the identity provider, roles per operation, actor taken from the verified token. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"fabor.auth-mode=oidc", "fabor.grpc-port=19091", "fabor.scheduler-enabled=false", "management.server.port=0"})
@Import(FaborOidcTest.Idp.class)
class FaborOidcTest {
    static final String ISSUER = "https://idp.test/realms/fabor";
    static final KeyPair KEYS = generate();
    static final KeyPair ROGUE = generate();

    static KeyPair generate() {
        try {
            KeyPairGenerator g = KeyPairGenerator.getInstance("RSA");
            g.initialize(2048);
            return g.generateKeyPair();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @TestConfiguration
    static class Idp {
        @Bean
        @Primary
        JwtDecoder decoder() {
            NimbusJwtDecoder d = NimbusJwtDecoder.withPublicKey((RSAPublicKey) KEYS.getPublic()).build();
            d.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer(ISSUER)));
            return d;
        }
    }

    @DynamicPropertySource
    static void db(DynamicPropertyRegistry r) {
        String url = System.getenv("FABOR_PG_URL");
        if (url != null) {
            r.add("spring.datasource.url", () -> url);
            r.add("spring.datasource.username", () -> System.getenv().getOrDefault("FABOR_PG_USER", "postgres"));
            r.add("spring.datasource.password", () -> System.getenv().getOrDefault("FABOR_PG_PASSWORD", ""));
        } else {
            Assumptions.assumeTrue(DockerClientFactory.instance().isDockerAvailable(), "No PostgreSQL; skipping");
            PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16");
            pg.start();
            r.add("spring.datasource.url", pg::getJdbcUrl);
            r.add("spring.datasource.username", pg::getUsername);
            r.add("spring.datasource.password", pg::getPassword);
        }
        r.add("fabor.master-key", () -> Base64.getEncoder().encodeToString(new byte[40]));
    }

    @Autowired TestRestTemplate http;
    @Autowired DataSource ds;

    static String jwt(KeyPair key, String issuer, String user, List<String> roles, Instant expires) throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder().issuer(issuer).subject("sub-" + user).claim("preferred_username", user)
                .claim("realm_access", Map.of("roles", roles)).issueTime(Date.from(Instant.now().minusSeconds(5)))
                .expirationTime(Date.from(expires)).build();
        SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.RS256), claims);
        jwt.sign(new RSASSASigner((RSAPrivateKey) key.getPrivate()));
        return jwt.serialize();
    }

    static String good(String user, String... roles) throws Exception {
        return jwt(KEYS, ISSUER, user, List.of(roles), Instant.now().plusSeconds(300));
    }

    HttpEntity<String> req(String token, String body) {
        HttpHeaders h = new HttpHeaders();
        if (token != null) {
            h.setBearerAuth(token);
        }
        h.setContentType(MediaType.TEXT_PLAIN);
        return new HttpEntity<>(body, h);
    }

    static String yaml() throws Exception {
        try (var in = FaborOidcTest.class.getResourceAsStream("/products/personal-loan.yaml")) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    @Test
    void tokensAreVerifiedAndRolesEnforced() throws Exception {
        try (Connection c = ds.getConnection(); Statement st = c.createStatement()) {
            st.execute("TRUNCATE catalog_draft, catalog_version, audit_log");
        }
        String url = "/api/v1/products/drafts";
        String y = yaml();
        // authentication: missing, forged, wrong issuer, expired
        assertThat(http.exchange(url, HttpMethod.POST, req(null, y), String.class).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(http.exchange(url, HttpMethod.POST, req("not.a.jwt", y), String.class).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        String forged = jwt(ROGUE, ISSUER, "mallory", List.of("product-maker"), Instant.now().plusSeconds(300));
        assertThat(http.exchange(url, HttpMethod.POST, req(forged, y), String.class).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        String otherIssuer = jwt(KEYS, "https://evil.test", "mallory", List.of("product-maker"), Instant.now().plusSeconds(300));
        assertThat(http.exchange(url, HttpMethod.POST, req(otherIssuer, y), String.class).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        String expired = jwt(KEYS, ISSUER, "maya", List.of("product-maker"), Instant.now().minusSeconds(120));
        assertThat(http.exchange(url, HttpMethod.POST, req(expired, y), String.class).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        // authorisation: valid token, wrong role
        assertThat(http.exchange(url, HttpMethod.POST, req(good("olivia", "ops"), y), String.class).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);

        // the maker creates and submits; the actor name is the token's, not a header
        ResponseEntity<Map> created = http.exchange(url, HttpMethod.POST, req(good("maya", "product-maker"), y), Map.class);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.OK);
        String id = (String) created.getBody().get("id");
        HttpHeaders spoof = new HttpHeaders();
        spoof.setBearerAuth(good("maya", "product-maker"));
        spoof.set("X-Actor", "someone-else");
        assertThat(http.exchange(url + "/" + id + "/submit", HttpMethod.POST, new HttpEntity<>(spoof), Map.class).getStatusCode())
                .isEqualTo(HttpStatus.OK);

        // approvals need the matching approver role, and the author may not approve their own product
        String approveUrl = url + "/" + id + "/approve";
        HttpHeaders json = new HttpHeaders();
        json.setContentType(MediaType.APPLICATION_JSON);
        json.setBearerAuth(good("bob", "approver-risk"));
        assertThat(http.exchange(approveUrl, HttpMethod.POST, new HttpEntity<>(Map.of("role", "PRODUCT"), json), Map.class)
                .getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);     // risk approver cannot sign for PRODUCT
        assertThat(http.exchange(approveUrl, HttpMethod.POST, new HttpEntity<>(Map.of("role", "RISK"), json), Map.class)
                .getStatusCode()).isEqualTo(HttpStatus.OK);
        HttpHeaders self = new HttpHeaders();
        self.setContentType(MediaType.APPLICATION_JSON);
        self.setBearerAuth(good("maya", "product-maker", "approver-product"));
        assertThat(http.exchange(approveUrl, HttpMethod.POST, new HttpEntity<>(Map.of("role", "PRODUCT"), self), Map.class)
                .getStatusCode()).isEqualTo(HttpStatus.CONFLICT);       // maker-checker: author cannot approve

        // publishing needs its own role
        HttpHeaders pub = new HttpHeaders();
        pub.setBearerAuth(good("ops-lead", "ops"));
        assertThat(http.exchange(url + "/" + id + "/publish", HttpMethod.POST, new HttpEntity<>(pub), Map.class).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);

        // gRPC: a user token is not enough, the ledger-client role is
        ManagedChannel ch = NettyChannelBuilder.forAddress("localhost", 19091).usePlaintext().build();
        try {
            GetBalanceRequest r = GetBalanceRequest.newBuilder().setTenant("bank-a").setAccount("x").setBalanceType("SETTLED")
                    .setCurrency("THB").setValueAsOf("2026-01-01").build();
            assertThat(grpcStatus(ch, r, good("maya", "product-maker"))).isEqualTo(io.grpc.Status.Code.UNAUTHENTICATED);
            assertThat(grpcStatus(ch, r, forged)).isEqualTo(io.grpc.Status.Code.UNAUTHENTICATED);
            assertThat(grpcStatus(ch, r, good("svc-payments", "ledger-client"))).isEqualTo(io.grpc.Status.Code.OK);
        } finally {
            ch.shutdownNow();
        }
    }

    static io.grpc.Status.Code grpcStatus(ManagedChannel ch, GetBalanceRequest r, String token) {
        Metadata md = new Metadata();
        md.put(Metadata.Key.of("authorization", Metadata.ASCII_STRING_MARSHALLER), "Bearer " + token);
        try {
            LedgerGrpc.newBlockingStub(ch).withInterceptors(MetadataUtils.newAttachHeadersInterceptor(md)).getBalance(r);
            return io.grpc.Status.Code.OK;
        } catch (StatusRuntimeException e) {
            return e.getStatus().getCode();
        }
    }
}
