package org.fabor.lending;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Collection events of delinquent loans, append only. */
public interface CollectionRepo {
    void add(CollectionEvent event);

    Optional<CollectionEvent> find(String loanId, String reference);

    /** The events of one loan, oldest first. */
    List<CollectionEvent> events(String loanId);

    final class InMemory implements CollectionRepo {
        private final Map<String, List<CollectionEvent>> byLoan = new HashMap<>();

        @Override
        public synchronized void add(CollectionEvent e) {
            byLoan.computeIfAbsent(e.loanId(), k -> new ArrayList<>()).add(e);
        }

        @Override
        public synchronized Optional<CollectionEvent> find(String loanId, String reference) {
            return events(loanId).stream().filter(e -> e.reference().equals(reference)).findFirst();
        }

        @Override
        public synchronized List<CollectionEvent> events(String loanId) {
            return List.copyOf(byLoan.getOrDefault(loanId, List.of()));
        }
    }
}
