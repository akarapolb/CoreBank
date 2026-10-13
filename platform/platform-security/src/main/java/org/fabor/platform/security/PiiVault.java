package org.fabor.platform.security;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.fabor.platform.tenancy.TenantId;

/**
 * Replaces national IDs, phone numbers and similar PII with opaque tokens everywhere else in the system.
 * Values are encrypted with AES-256-GCM under a per-tenant key (the token is bound as authenticated data, so
 * a ciphertext cannot be moved to another token). A keyed hash (blind index) allows exact-match lookup
 * without decrypting. Only callers holding a purpose from the allowed set can detokenize, and every
 * detokenization is reported to the audit hook.
 */
public final class PiiVault {
    private static final SecureRandom RANDOM = new SecureRandom();

    public interface DetokenizeAudit {
        void detokenized(TenantId tenant, String token, String purpose, String actor);
    }

    /** One encrypted value. The store never sees plaintext. */
    public record Entry(String keyId, byte[] nonce, byte[] ciphertext, String index) { }

    /** Storage port. {@code putIfAbsent} is atomic on (tenant, index): the first writer's token wins. */
    public interface Store {
        /** @return the token already holding this blind index, or empty if {@code token} was stored */
        Optional<String> putIfAbsent(TenantId tenant, String token, Entry entry);

        Optional<Entry> get(TenantId tenant, String token);

        Optional<String> tokenByIndex(TenantId tenant, String index);

        /** Replaces an entry's encryption (same token and index). */
        void replace(TenantId tenant, String token, Entry entry);

        /** Every (token, entry) of the tenant, for key rotation. */
        Map<String, Entry> all(TenantId tenant);
    }

    /** In-memory store for tests. */
    public static final class InMemoryStore implements Store {
        private final Map<String, Entry> entries = new HashMap<>();
        private final Map<String, String> byIndex = new HashMap<>();

        @Override
        public synchronized Optional<String> putIfAbsent(TenantId t, String token, Entry e) {
            String existing = byIndex.get(t.value() + "/" + e.index());
            if (existing != null) {
                return Optional.of(existing);
            }
            entries.put(t.value() + "/" + token, e);
            byIndex.put(t.value() + "/" + e.index(), token);
            return Optional.empty();
        }

        @Override
        public synchronized Optional<Entry> get(TenantId t, String token) {
            return Optional.ofNullable(entries.get(t.value() + "/" + token));
        }

        @Override
        public synchronized Optional<String> tokenByIndex(TenantId t, String index) {
            return Optional.ofNullable(byIndex.get(t.value() + "/" + index));
        }

        @Override
        public synchronized void replace(TenantId t, String token, Entry e) {
            entries.put(t.value() + "/" + token, e);
        }

        @Override
        public synchronized Map<String, Entry> all(TenantId t) {
            Map<String, Entry> out = new HashMap<>();
            String prefix = t.value() + "/";
            entries.forEach((k, v) -> {
                if (k.startsWith(prefix)) {
                    out.put(k.substring(prefix.length()), v);
                }
            });
            return out;
        }
    }

    private final KeyProvider keys;
    private final Set<String> allowedPurposes;
    private final DetokenizeAudit audit;
    private final Store store;

    public PiiVault(KeyProvider keys, Set<String> allowedPurposes, DetokenizeAudit audit) {
        this(keys, allowedPurposes, audit, new InMemoryStore());
    }

    public PiiVault(KeyProvider keys, Set<String> allowedPurposes, DetokenizeAudit audit, Store store) {
        this.keys = keys;
        this.allowedPurposes = Set.copyOf(allowedPurposes);
        this.audit = audit;
        this.store = store;
    }

    /** Tokenizes a value. The same value always maps to the same token within a tenant and field. */
    public String tokenize(TenantId tenant, String field, String value) {
        String index = blindIndex(tenant, field, value);
        Optional<String> existing = store.tokenByIndex(tenant, index);
        if (existing.isPresent()) {
            return existing.get();
        }
        byte[] rnd = new byte[12];
        RANDOM.nextBytes(rnd);
        String token = "tok_" + field + "_" + HexFormat.of().formatHex(rnd);
        String keyId = keys.currentKeyId(tenant);
        byte[] nonce = new byte[12];
        RANDOM.nextBytes(nonce);
        Entry entry = new Entry(keyId, nonce, crypt(Cipher.ENCRYPT_MODE, tenant, keyId, token, nonce,
                value.getBytes(StandardCharsets.UTF_8)), index);
        // a concurrent writer may have stored the same value first: its token wins
        return store.putIfAbsent(tenant, token, entry).orElse(token);
    }

    /** @throws SecurityException if the purpose is not allowed */
    public Optional<String> detokenize(TenantId tenant, String token, String purpose, String actor) {
        if (!allowedPurposes.contains(purpose)) {
            throw new SecurityException("Purpose not permitted for PII access: " + purpose);
        }
        Optional<Entry> found = store.get(tenant, token);
        if (found.isEmpty()) {
            return Optional.empty();
        }
        Entry e = found.get();
        audit.detokenized(tenant, token, purpose, actor);
        return Optional.of(new String(crypt(Cipher.DECRYPT_MODE, tenant, e.keyId(), token, e.nonce(), e.ciphertext()),
                StandardCharsets.UTF_8));
    }

    /** Token for an exact value, if it was tokenized before, without decrypting anything. */
    public Optional<String> lookup(TenantId tenant, String field, String value) {
        return store.tokenByIndex(tenant, blindIndex(tenant, field, value));
    }

    /** Re-encrypts every entry of the tenant under the current key. Tokens do not change. @return entries rotated */
    public int rotate(TenantId tenant) {
        String current = keys.currentKeyId(tenant);
        int n = 0;
        for (var en : store.all(tenant).entrySet()) {
            if (en.getValue().keyId().equals(current)) {
                continue;
            }
            String token = en.getKey();
            Entry old = en.getValue();
            byte[] plain = crypt(Cipher.DECRYPT_MODE, tenant, old.keyId(), token, old.nonce(), old.ciphertext());
            byte[] nonce = new byte[12];
            RANDOM.nextBytes(nonce);
            store.replace(tenant, token, new Entry(current, nonce,
                    crypt(Cipher.ENCRYPT_MODE, tenant, current, token, nonce, plain), old.index()));
            n++;
        }
        return n;
    }

    /** What is actually stored for a token (for tests and forensics): never contains the plaintext. */
    public String storedForm(TenantId tenant, String token) {
        return store.get(tenant, token).map(e -> e.keyId() + ":" + Base64.getEncoder().encodeToString(e.ciphertext())).orElse(null);
    }

    private byte[] crypt(int mode, TenantId tenant, String keyId, String token, byte[] nonce, byte[] data) {
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(mode, new SecretKeySpec(keys.dataKey(tenant, keyId), "AES"), new GCMParameterSpec(128, nonce));
            c.updateAAD((tenant.value() + "/" + token).getBytes(StandardCharsets.UTF_8));
            return c.doFinal(data);
        } catch (GeneralSecurityException e) {
            throw new SecurityException("PII vault cryptographic failure", e);
        }
    }

    private String blindIndex(TenantId tenant, String field, String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(keys.indexKey(tenant), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal((field + "\u001f" + value).getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new SecurityException("PII vault cryptographic failure", e);
        }
    }
}
