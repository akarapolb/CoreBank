package org.fabor.assets;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface DealerRepo {
    void save(Dealer dealer);

    Optional<Dealer> find(String id);

    List<Dealer> all();

    final class InMemory implements DealerRepo {
        private final Map<String, Dealer> dealers = new HashMap<>();

        @Override
        public synchronized void save(Dealer d) {
            dealers.put(d.id(), d);
        }

        @Override
        public synchronized Optional<Dealer> find(String id) {
            return Optional.ofNullable(dealers.get(id));
        }

        @Override
        public synchronized List<Dealer> all() {
            return dealers.values().stream().sorted(java.util.Comparator.comparing(Dealer::id)).toList();
        }
    }
}
