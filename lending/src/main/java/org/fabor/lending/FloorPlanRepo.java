package org.fabor.lending;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface FloorPlanRepo {
    void saveLine(FloorPlanLine line);

    Optional<FloorPlanLine> findLine(String id);

    void saveUnit(FloorPlanUnit unit);

    Optional<FloorPlanUnit> findUnit(String lineId, String unitId);

    /** The units of one line, oldest draw first. */
    List<FloorPlanUnit> units(String lineId);

    /** Ids of every line, in id order. */
    List<String> lineIds();

    final class InMemory implements FloorPlanRepo {
        private final Map<String, FloorPlanLine> lines = new HashMap<>();
        private final Map<String, FloorPlanUnit> units = new HashMap<>();

        @Override
        public synchronized void saveLine(FloorPlanLine l) {
            lines.put(l.id(), l);
        }

        @Override
        public synchronized Optional<FloorPlanLine> findLine(String id) {
            return Optional.ofNullable(lines.get(id));
        }

        @Override
        public synchronized void saveUnit(FloorPlanUnit u) {
            units.put(u.lineId() + "/" + u.unitId(), u);
        }

        @Override
        public synchronized Optional<FloorPlanUnit> findUnit(String lineId, String unitId) {
            return Optional.ofNullable(units.get(lineId + "/" + unitId));
        }

        @Override
        public synchronized List<String> lineIds() {
            return lines.keySet().stream().sorted().toList();
        }

        @Override
        public synchronized List<FloorPlanUnit> units(String lineId) {
            return units.values().stream().filter(u -> u.lineId().equals(lineId))
                    .sorted(java.util.Comparator.comparing(FloorPlanUnit::drawnOn).thenComparing(FloorPlanUnit::unitId)).toList();
        }
    }
}
