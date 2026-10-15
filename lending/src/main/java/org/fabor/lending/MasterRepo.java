package org.fabor.lending;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface MasterRepo {
    void save(MasterAgreement master);

    Optional<MasterAgreement> find(String id);

    void addSchedule(MasterAgreement.Schedule schedule);

    /** The call-offs of one agreement, oldest first. */
    List<MasterAgreement.Schedule> schedules(String masterId);

    final class InMemory implements MasterRepo {
        private final Map<String, MasterAgreement> masters = new HashMap<>();
        private final List<MasterAgreement.Schedule> schedules = new ArrayList<>();

        @Override
        public synchronized void save(MasterAgreement m) {
            masters.put(m.id(), m);
        }

        @Override
        public synchronized Optional<MasterAgreement> find(String id) {
            return Optional.ofNullable(masters.get(id));
        }

        @Override
        public synchronized void addSchedule(MasterAgreement.Schedule s) {
            schedules.add(s);
        }

        @Override
        public synchronized List<MasterAgreement.Schedule> schedules(String masterId) {
            return schedules.stream().filter(s -> s.masterId().equals(masterId)).toList();
        }
    }
}
