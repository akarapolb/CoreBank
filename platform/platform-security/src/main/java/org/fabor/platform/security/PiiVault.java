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

    private record Entry(String keyId, byte[] nonce, byte[] ciphertext, String index) { }

    private final KeyProvider keys;
    private final Set<String> allowedPurposes;
    private final DetokenizeAudit audit;
    private final Map<String, Entry> store = new HashMap<>();
    private final Map<String, String> byIndex = new HashMap<>();

    public PiiVault(KeyProvider keys, Set<String> allowedPurposes, DetokenizeAudit audit) {
        this.keys = keys;
        this.allowedPurposes = Set.copyOf(allowedPurposes);
        this.audit = audit;
    }

    /** Tokenizes a value. The same value always maps to the same token within a tenant and field. */
    public synchronized String tokenize(TenantId tenant, String field, String value) {
        String index = blindIndex(tenant, field, value);
        String existing = byIndex.get(tenant.value() + "/" + index);
        if (existing != null) {
            return existing;
        }
        byte[] rnd = new byte[12];
        RANDOM.nextBytes(rnd);
        String token = "tok_" + field + "_" + HexFormat.of().formatHex(rnd);
        String keyId = keys.currentKeyId(tenant);
        byte[] nonce = new byte[12];
        RANDOM.nextBytes(nonce);
        store.put(tenant.value() + "/" + token, new Entry(keyId, nonce, crypt(Cipher.ENCRYPT_MODE, tenant, keyId, token, nonce,
                value.getBytes(StandardCharsets.UTF_8)), index));
        byIndex.put(tenant.value() + "/" + index, token);
        return token;
    }

    /** @throws SecurityException if the purpose is not allowed */
    public synchronized Optional<String> detokenize(TenantId tenant, String token, String purpose, String actor) {
        if (!allowedPurposes.contains(purpose)) {
            throw new SecurityException("Purpose not permitted for PII access: " + purpose);
        }
        Entry e = store.get(tenant.value() + "/" + token);
        if (e == null) {
            return Optional.empty();
        }
        audit.detokenized(tenant, token, purpose, actor);
        return Optional.of(new String(crypt(Cipher.DECRYPT_MODE, tenant, e.keyId(), token, e.nonce(), e.ciphertext()),
                StandardCharsets.UTF_8));
    }

    /** Token for an exact value, if it was tokenized before, without decrypting anything. */
    public synchronized Optional<String> lookup(TenantId tenant, String field, String value) {
        return Optional.ofNullable(byIndex.get(tenant.value() + "/" + blindIndex(tenant, field, value)));
    }

    /** Re-encrypts every entry of the tenant under the current key. Tokens do not change. @return entries rotated */
    public synchronized int rotate(TenantId tenant) {
        String current = keys.currentKeyId(tenant);
        int n = 0;
        for (var en : Map.copyOf(store).entrySet()) {
            if (!en.getKey().startsWith(tenant.value() + "/") || en.getValue().keyId().equals(current)) {
                continue;
            }
            String token = en.getKey().substring(tenant.value().length() + 1);
            Entry old = en.getValue();
            byte[] plain = crypt(Cipher.DECRYPT_MODE, tenant, old.keyId(), token, old.nonce(), old.ciphertext());
            byte[] nonce = new byte[12];
            RANDOM.nextBytes(nonce);
            store.put(en.getKey(), new Entry(current, nonce, crypt(Cipher.ENCRYPT_MODE, tenant, current, token, nonce, plain),
                    old.index()));
            n++;
        }
        return n;
    }

    /** What is actually stored for a token (for tests and forensics): never contains the plaintext. */
    public synchronized String storedForm(TenantId tenant, String token) {
        Entry e = store.get(tenant.value() + "/" + token);
        return e == null ? null : e.keyId() + ":" + Base64.getEncoder().encodeToString(e.ciphertext());
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
