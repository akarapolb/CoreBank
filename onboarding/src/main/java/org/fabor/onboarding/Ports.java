package org.fabor.onboarding;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

/** Outbound ports to external services. Adapters live elsewhere; tests use in-memory fakes. */
public final class Ports {
    private Ports() { }

    public record EkycResult(boolean passed, double livenessScore, String reason) { }

    public interface EkycProvider {
        EkycResult verify(String nationalId, String fullName, LocalDate dateOfBirth, String documentImageRef);
    }

    public record BureauReport(int score, int delinquencies12m) { }

    public interface CreditBureau {
        Optional<BureauReport> lookup(String nationalId);
    }

    public interface PartyRepo {
        void save(Party p);

        Optional<Party> find(String id);

        final class InMemory implements PartyRepo {
            private final Map<String, Party> map = new java.util.concurrent.ConcurrentHashMap<>();

            @Override
            public void save(Party p) {
                map.put(p.id(), p);
            }

            @Override
            public Optional<Party> find(String id) {
                return Optional.ofNullable(map.get(id));
            }
        }
    }
}
