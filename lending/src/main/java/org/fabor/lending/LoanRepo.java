package org.fabor.lending;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public interface LoanRepo {
    void save(Loan loan);

    Optional<Loan> find(String id);

    /** Ids of all loans of one party, newest first. */
    java.util.List<String> idsByParty(String party);

    /** Ids of loans that still need servicing (neither closed nor written off). */
    java.util.List<String> activeIds();

    final class InMemory implements LoanRepo {
        private final Map<String, Loan> loans = new HashMap<>();

        @Override
        public synchronized void save(Loan l) {
            loans.put(l.id(), l);
        }

        @Override
        public synchronized Optional<Loan> find(String id) {
            return Optional.ofNullable(loans.get(id));
        }

        @Override
        public synchronized java.util.List<String> idsByParty(String party) {
            return loans.values().stream().filter(l -> l.party().equals(party)).map(Loan::id).sorted(java.util.Comparator.reverseOrder()).toList();
        }

        @Override
        public synchronized java.util.List<String> activeIds() {
            return loans.values().stream().filter(l -> l.status() != Loan.Status.CLOSED && l.status() != Loan.Status.WRITTEN_OFF).map(Loan::id).sorted().toList();
        }
    }
}
