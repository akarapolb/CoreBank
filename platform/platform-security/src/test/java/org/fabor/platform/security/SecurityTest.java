package org.fabor.platform.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.fabor.platform.tenancy.TenantId;
import org.junit.jupiter.api.Test;

class SecurityTest {
    static final TenantId T = new TenantId("bank-a");
    static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");

    /** Test keys; production uses a KMS-backed provider. */
    static final class FixedKeys implements KeyProvider {
        String current = "k1";

        @Override
        public String currentKeyId(TenantId t) {
            return current;
        }

        @Override
        public byte[] dataKey(TenantId t, String keyId) {
            byte[] k = new byte[32];
            Arrays.fill(k, (byte) (keyId.hashCode() + t.value().hashCode()));
            return k;
        }

        @Override
        public byte[] indexKey(TenantId t) {
            byte[] k = new byte[32];
            Arrays.fill(k, (byte) 7);
            return k;
        }
    }

    // ---- audit log
    @Test
    void auditChainVerifiesAndDetectsTampering() {
        AuditLog log = new AuditLog();
        log.append(T0, "HUMAN", "alice", null, "PRODUCT_PUBLISHED", "PERSONAL_LOAN_STD:1", "approved by 4 roles");
        log.append(T0.plusSeconds(1), "AGENT", "assistant-1", "customer-42", "BALANCE_READ", "acc-1", null);
        log.append(T0.plusSeconds(2), "SYSTEM", "scheduler", null, "ACCRUAL_POSTED", "ARR-1", "");
        assertThat(log.verify().ok()).isTrue();
        assertThat(log.head().orElseThrow().seq()).isEqualTo(3);
        assertThat(log.all().get(1).onBehalfOf()).isEqualTo("customer-42");

        List<AuditLog.Record> copy = new ArrayList<>(log.all());
        AuditLog.Record r = copy.get(1);
        copy.set(1, new AuditLog.Record(r.seq(), r.at(), r.actorType(), "mallory", r.onBehalfOf(), r.action(), r.subject(),
                r.detail(), r.prevHash(), r.hash()));
        assertThat(AuditLog.verify(copy)).isEqualTo(new AuditLog.Verification(false, 2));
        List<AuditLog.Record> deleted = new ArrayList<>(log.all());
        deleted.remove(1);
        assertThat(AuditLog.verify(deleted).ok()).isFalse();
        List<AuditLog.Record> reordered = new ArrayList<>(log.all());
        java.util.Collections.swap(reordered, 0, 1);
        assertThat(AuditLog.verify(reordered).ok()).isFalse();
        assertThat(new AuditLog().head()).isEmpty();
        assertThat(new AuditLog().verify().ok()).isTrue();
    }

    // ---- PII vault
    @Test
    void vaultTokenizesWithoutStoringPlaintextAndAuditsReads() {
        List<String> audited = new ArrayList<>();
        PiiVault v = new PiiVault(new FixedKeys(), Set.of("KYC_REVIEW"), (t, tok, p, a) -> audited.add(a + ":" + p));
        String tok = v.tokenize(T, "national_id", "1101700230673");
        assertThat(tok).startsWith("tok_national_id_").doesNotContain("1101700230673");
        assertThat(v.storedForm(T, tok)).doesNotContain("1101700230673");
        assertThat(v.tokenize(T, "national_id", "1101700230673")).isEqualTo(tok);
        assertThat(v.tokenize(T, "phone", "1101700230673")).isNotEqualTo(tok);
        assertThat(v.lookup(T, "national_id", "1101700230673")).contains(tok);
        assertThat(v.lookup(T, "national_id", "9999")).isEmpty();
        assertThat(v.detokenize(T, tok, "KYC_REVIEW", "officer-1")).contains("1101700230673");
        assertThat(audited).containsExactly("officer-1:KYC_REVIEW");
        assertThat(v.detokenize(T, "tok_missing", "KYC_REVIEW", "officer-1")).isEqualTo(Optional.empty());
        assertThat(v.storedForm(T, "tok_missing")).isNull();
        assertThatThrownBy(() -> v.detokenize(T, tok, "MARKETING", "officer-1")).isInstanceOf(SecurityException.class);
        assertThat(audited).hasSize(1);
    }

    @Test
    void tenantsAreIsolatedAndCiphertextIsBoundToItsToken() {
        PiiVault v = new PiiVault(new FixedKeys(), Set.of("P"), (t, tok, p, a) -> { });
        String a = v.tokenize(T, "phone", "0812345678");
        String b = v.tokenize(new TenantId("bank-b"), "phone", "0812345678");
        assertThat(a).isNotEqualTo(b);
        assertThat(v.detokenize(new TenantId("bank-b"), a, "P", "x")).isEmpty();
        assertThat(v.detokenize(T, a, "P", "x")).contains("0812345678");
    }

    @Test
    void keyRotationReencryptsWithoutChangingTokens() {
        FixedKeys keys = new FixedKeys();
        PiiVault v = new PiiVault(keys, Set.of("P"), (t, tok, p, a) -> { });
        String tok = v.tokenize(T, "phone", "0899999999");
        String before = v.storedForm(T, tok);
        keys.current = "k2";
        assertThat(v.rotate(T)).isEqualTo(1);
        assertThat(v.rotate(T)).isZero();
        assertThat(v.rotate(new TenantId("bank-b"))).isZero();
        assertThat(v.storedForm(T, tok)).isNotEqualTo(before).startsWith("k2:");
        assertThat(v.detokenize(T, tok, "P", "x")).contains("0899999999");
    }

    // ---- consent
    @Test
    void consentLifecycleAndVersions() {
        ConsentRegistry c = new ConsentRegistry();
        c.grant(T, "party-1", "CREDIT_BUREAU", 1, T0, "APP");
        c.grant(T, "party-1", "MARKETING", 2, T0.plusSeconds(10), "BRANCH");
        assertThat(c.isGranted(T, "party-1", "CREDIT_BUREAU", 1, T0.plusSeconds(1))).isTrue();
        assertThat(c.isGranted(T, "party-1", "CREDIT_BUREAU", 2, T0.plusSeconds(1))).isFalse();   // saw an older text
        assertThat(c.isGranted(T, "party-1", "CREDIT_BUREAU", 1, T0.minusSeconds(1))).isFalse();  // before the grant
        assertThat(c.isGranted(T, "party-2", "CREDIT_BUREAU", 1, T0.plusSeconds(1))).isFalse();
        c.withdraw(T, "party-1", "MARKETING", T0.plusSeconds(20), "APP");
        assertThat(c.isGranted(T, "party-1", "MARKETING", 1, T0.plusSeconds(15))).isTrue();
        assertThat(c.isGranted(T, "party-1", "MARKETING", 1, T0.plusSeconds(25))).isFalse();
        assertThat(c.current(T, "party-1", T0.plusSeconds(30))).containsOnlyKeys("CREDIT_BUREAU");
        assertThat(c.history(T, "party-1", "MARKETING")).extracting(ConsentRegistry.Event::action)
                .containsExactly(ConsentRegistry.Action.GRANTED, ConsentRegistry.Action.WITHDRAWN);
        assertThat(c.history(T, "nobody", "X")).isEmpty();
        // withdrawing something never granted is recorded (an explicit refusal) and stays withdrawn
        c.withdraw(T, "party-3", "SHARING", T0, "APP");
        assertThat(c.isGranted(T, "party-3", "SHARING", 0, T0.plusSeconds(1))).isFalse();
        assertThatThrownBy(() -> c.grant(T, "party-1", "MARKETING", 2, T0, "APP")).isInstanceOf(IllegalArgumentException.class);
    }
}
