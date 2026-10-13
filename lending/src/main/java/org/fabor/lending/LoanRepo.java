package org.fabor.lending;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public interface LoanRepo {
    void save(Loan loan);

    Optional<Loan> find(String id);

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
    }
}
