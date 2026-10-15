package org.fabor.lending;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface LeaseRepo {
    void save(Lease lease);

    Optional<Lease> find(String id);

    /** Ids of all leases of one party, newest first. */
    List<String> idsByParty(String party);

    final class InMemory implements LeaseRepo {
        private final Map<String, Lease> leases = new HashMap<>();

        @Override
        public synchronized void save(Lease l) {
            leases.put(l.id(), l);
        }

        @Override
        public synchronized Optional<Lease> find(String id) {
            return Optional.ofNullable(leases.get(id));
        }

        @Override
        public synchronized List<String> idsByParty(String party) {
            return leases.values().stream().filter(l -> l.party().equals(party)).map(Lease::id)
                    .sorted(java.util.Comparator.reverseOrder()).toList();
        }
    }
}
