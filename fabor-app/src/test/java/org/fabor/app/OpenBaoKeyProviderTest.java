package org.fabor.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Base64;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.fabor.platform.security.PiiVault;
import org.fabor.platform.tenancy.TenantId;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** The provider against a stub that speaks the OpenBao KV v2 read API. */
class OpenBaoKeyProviderTest {
    static final TenantId T = new TenantId("bank-a");
    HttpServer server;
    final AtomicReference<String> body = new AtomicReference<>();
    final AtomicInteger status = new AtomicInteger(200);
    final AtomicInteger calls = new AtomicInteger();
    final AtomicReference<String> tokenSeen = new AtomicReference<>();
    String url;

    static String b64(int fill) {
        byte[] k = new byte[32];
        Arrays.fill(k, (byte) fill);
        return Base64.getEncoder().encodeToString(k);
    }

    static String secret(String current, String keys, String index) {
        return "{\"data\":{\"data\":{\"current\":\"" + current + "\",\"keys\":{" + keys + "},\"index\":\"" + index + "\"}}}";
    }

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/secret/data/fabor/bank-a/vault", ex -> {
            calls.incrementAndGet();
            tokenSeen.set(ex.getRequestHeaders().getFirst("X-Vault-Token"));
            byte[] out = body.get().getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(status.get(), out.length);
            ex.getResponseBody().write(out);
            ex.close();
        });
        server.start();
        url = "http://127.0.0.1:" + server.getAddress().getPort() + "/v1";
        body.set(secret("k2", "\"k1\":\"" + b64(1) + "\",\"k2\":\"" + b64(2) + "\"", b64(9)));
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    OpenBaoKeyProvider provider(Clock clock) {
        return new OpenBaoKeyProvider(url, "s.token", "secret", Duration.ofMinutes(5), clock);
    }

    @Test
    void readsKeysWithTheTokenAndCachesThem() {
        OpenBaoKeyProvider p = provider(Clock.systemUTC());
        assertThat(p.currentKeyId(T)).isEqualTo("k2");
        assertThat(p.dataKey(T, "k1")).containsOnly((byte) 1);
        assertThat(p.dataKey(T, "k2")).hasSize(32).containsOnly((byte) 2);
        assertThat(p.indexKey(T)).containsOnly((byte) 9);
        assertThat(tokenSeen.get()).isEqualTo("s.token");
        assertThat(calls.get()).isEqualTo(1);                                    // one read serves all lookups
        assertThatThrownBy(() -> p.dataKey(T, "k0")).isInstanceOf(SecurityException.class).hasMessageContaining("Unknown key id");
    }

    @Test
    void cacheExpiresSoRotationTakesEffect() {
        Instant[] now = {Instant.parse("2026-01-01T00:00:00Z")};
        Clock clock = new Clock() {
            public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
            public Clock withZone(java.time.ZoneId z) { return this; }
            public Instant instant() { return now[0]; }
        };
        OpenBaoKeyProvider p = provider(clock);
        assertThat(p.currentKeyId(T)).isEqualTo("k2");
        body.set(secret("k3", "\"k3\":\"" + b64(3) + "\"", b64(9)));
        assertThat(p.currentKeyId(T)).isEqualTo("k2");                           // still cached
        now[0] = now[0].plusSeconds(301);
        assertThat(p.currentKeyId(T)).isEqualTo("k3");                           // refreshed after the TTL
        assertThat(calls.get()).isEqualTo(2);
    }

    @Test
    void failsClosedOnEveryBadResponse() {
        status.set(403);
        assertThatThrownBy(() -> provider(Clock.systemUTC()).currentKeyId(T)).isInstanceOf(SecurityException.class).hasMessageContaining("403");
        status.set(200);
        body.set(secret("", "\"k1\":\"" + b64(1) + "\"", b64(9)));
        assertThatThrownBy(() -> provider(Clock.systemUTC()).currentKeyId(T)).hasMessageContaining("no current key");
        body.set(secret("k9", "\"k1\":\"" + b64(1) + "\"", b64(9)));
        assertThatThrownBy(() -> provider(Clock.systemUTC()).currentKeyId(T)).hasMessageContaining("no current key");
        body.set(secret("k1", "\"k1\":\"" + Base64.getEncoder().encodeToString(new byte[16]) + "\"", b64(9)));
        assertThatThrownBy(() -> provider(Clock.systemUTC()).currentKeyId(T)).hasMessageContaining("32 bytes");
        body.set(secret("k1", "\"k1\":\"!!!notbase64\"", b64(9)));
        assertThatThrownBy(() -> provider(Clock.systemUTC()).currentKeyId(T)).hasMessageContaining("Malformed");
        body.set("not json");
        assertThatThrownBy(() -> provider(Clock.systemUTC()).currentKeyId(T)).isInstanceOf(SecurityException.class);
        server.stop(0);
        assertThatThrownBy(() -> provider(Clock.systemUTC()).currentKeyId(T)).hasMessageContaining("unreachable");
    }

    @Test
    void vaultWorksEndToEndOnTopOfIt() {
        PiiVault v = new PiiVault(provider(Clock.systemUTC()), java.util.Set.of("P"), (t, tok, p, a) -> { });
        String tok = v.tokenize(T, "phone", "0812345678");
        assertThat(v.detokenize(T, tok, "P", "x")).contains("0812345678");
        assertThat(v.storedForm(T, tok)).startsWith("k2:");
        assertThatThrownBy(() -> new FaborProperties("t", "oidc", null, null, 0, false, false, "openbao", "", "", null))
                .isInstanceOf(IllegalStateException.class);
        assertThat(new FaborProperties("t", "oidc", null, null, 0, false, false, "openbao", url, "tok", null).openbaoMount()).isEqualTo("secret");
        assertThatThrownBy(() -> new FaborProperties("t", "oidc", null, null, 0, false, false, "weird", "", "", null))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new FaborProperties("t", "oidc", null, "", 0, false, false, "config", "", "", null))
                .isInstanceOf(IllegalStateException.class);
    }
}
