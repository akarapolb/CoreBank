package org.fabor.app;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import org.fabor.platform.security.KeyProvider;
import org.fabor.platform.tenancy.TenantId;

/**
 * Key provider backed by OpenBao (or Vault) KV v2: one secret per tenant at {@code <mount>/data/fabor/<tenant>/vault}
 * holding {@code current} (key id), {@code keys} (id to base64 32-byte key) and {@code index} (base64 32-byte key).
 * Keys are cached for a short time so a rotation or revocation takes effect quickly. It fails closed: an unreachable
 * server, a missing secret or a malformed key stops PII access instead of falling back to anything weaker.
 */
final class OpenBaoKeyProvider implements KeyProvider {
    private static final ObjectMapper JSON = new ObjectMapper();

    private record Material(String current, Map<String, byte[]> keys, byte[] index, Instant fetched) { }

    private final HttpClient http;
    private final URI base;
    private final String token;
    private final String mount;
    private final Duration ttl;
    private final Clock clock;
    private final Map<String, Material> cache = new HashMap<>();

    OpenBaoKeyProvider(String url, String token, String mount, Duration ttl, Clock clock) {
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
        this.base = URI.create(url.endsWith("/") ? url : url + "/");
        this.token = token;
        this.mount = mount;
        this.ttl = ttl;
        this.clock = clock;
    }

    @Override
    public String currentKeyId(TenantId tenant) {
        return material(tenant).current();
    }

    @Override
    public byte[] dataKey(TenantId tenant, String keyId) {
        byte[] k = material(tenant).keys().get(keyId);
        if (k == null) {
            throw new SecurityException("Unknown key id " + keyId + " for tenant " + tenant.value());
        }
        return k.clone();
    }

    @Override
    public byte[] indexKey(TenantId tenant) {
        return material(tenant).index().clone();
    }

    private synchronized Material material(TenantId tenant) {
        Material m = cache.get(tenant.value());
        if (m != null && m.fetched().plus(ttl).isAfter(clock.instant())) {
            return m;
        }
        Material fresh = fetch(tenant);
        cache.put(tenant.value(), fresh);
        return fresh;
    }

    private Material fetch(TenantId tenant) {
        HttpRequest req = HttpRequest.newBuilder(base.resolve(mount + "/data/fabor/" + tenant.value() + "/vault"))
                .header("X-Vault-Token", token).timeout(Duration.ofSeconds(5)).GET().build();
        try {
            HttpResponse<String> r = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (r.statusCode() != 200) {
                throw new SecurityException("Key store returned HTTP " + r.statusCode() + " for tenant " + tenant.value());
            }
            JsonNode data = JSON.readTree(r.body()).path("data").path("data");
            String current = data.path("current").asText("");
            Map<String, byte[]> keys = new HashMap<>();
            data.path("keys").properties().forEach(e -> keys.put(e.getKey(), key(e.getValue().asText(""))));
            byte[] index = key(data.path("index").asText(""));
            if (current.isEmpty() || !keys.containsKey(current)) {
                throw new SecurityException("Key store has no current key for tenant " + tenant.value());
            }
            return new Material(current, Map.copyOf(keys), index, clock.instant());
        } catch (IOException e) {
            throw new SecurityException("Key store unreachable or unreadable", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new SecurityException("Interrupted while reading the key store", e);
        }
    }

    private static byte[] key(String b64) {
        byte[] k;
        try {
            k = Base64.getDecoder().decode(b64);
        } catch (IllegalArgumentException e) {
            throw new SecurityException("Malformed key in key store", e);
        }
        if (k.length != 32) {
            throw new SecurityException("Keys must be 32 bytes");
        }
        return k;
    }
}
