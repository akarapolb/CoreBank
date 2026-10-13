package org.fabor.platform.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

/**
 * Append-only audit log with hash chaining: each record commits to the one before it, so any edit,
 * deletion or reordering breaks {@link #verify}. Production ships the head hash to WORM storage.
 * The actor can be a person, a service or an AI agent (with the human it acts for).
 */
public final class AuditLog {
    public static final String GENESIS = "0".repeat(64);

    public record Record(long seq, Instant at, String actorType, String actor, String onBehalfOf, String action,
                         String subject, String detail, String prevHash, String hash) { }

    public record Verification(boolean ok, long firstBadSeq) { }

    private final List<Record> records = new ArrayList<>();

    public synchronized Record append(Instant at, String actorType, String actor, String onBehalfOf, String action,
                                      String subject, String detail) {
        String prev = records.isEmpty() ? GENESIS : records.get(records.size() - 1).hash();
        long seq = records.size() + 1L;
        Record r = new Record(seq, at, actorType, actor, onBehalfOf == null ? "" : onBehalfOf, action, subject,
                detail == null ? "" : detail, prev, "");
        Record sealed = new Record(r.seq(), r.at(), r.actorType(), r.actor(), r.onBehalfOf(), r.action(), r.subject(),
                r.detail(), prev, hashOf(r));
        records.add(sealed);
        return sealed;
    }

    public synchronized List<Record> all() {
        return List.copyOf(records);
    }

    public synchronized Optional<Record> head() {
        return records.isEmpty() ? Optional.empty() : Optional.of(records.get(records.size() - 1));
    }

    public synchronized Verification verify() {
        return verify(records);
    }

    /** Verifies any exported copy of the log. */
    public static Verification verify(List<Record> log) {
        String prev = GENESIS;
        long expectedSeq = 1;
        for (Record r : log) {
            if (r.seq() != expectedSeq || !r.prevHash().equals(prev) || !r.hash().equals(hashOf(r))) {
                return new Verification(false, r.seq());
            }
            prev = r.hash();
            expectedSeq++;
        }
        return new Verification(true, 0);
    }

    private static String hashOf(Record r) {
        String canonical = String.join("\u001f", Long.toString(r.seq()), r.at().toString(), r.actorType(), r.actor(),
                r.onBehalfOf(), r.action(), r.subject(), r.detail(), r.prevHash());
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
