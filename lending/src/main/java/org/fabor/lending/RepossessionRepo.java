package org.fabor.lending;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface RepossessionRepo {
    /** Inserts the case, or updates it when the reference exists (it moves from OPEN to SOLD). */
    void save(Repossession r);

    Optional<Repossession> find(String reference);

    /** The cases of one loan, oldest first. */
    List<Repossession> forLoan(String loanId);

    final class InMemory implements RepossessionRepo {
        private final Map<String, Repossession> cases = new LinkedHashMap<>();

        @Override
        public synchronized void save(Repossession r) {
            cases.put(r.reference(), r);
        }

        @Override
        public synchronized Optional<Repossession> find(String reference) {
            return Optional.ofNullable(cases.get(reference));
        }

        @Override
        public synchronized List<Repossession> forLoan(String loanId) {
            List<Repossession> out = new ArrayList<>();
            for (Repossession r : cases.values()) {
                if (r.loanId().equals(loanId)) {
                    out.add(r);
                }
            }
            return List.copyOf(out);
        }
    }
}
