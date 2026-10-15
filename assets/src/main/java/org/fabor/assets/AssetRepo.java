package org.fabor.assets;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface AssetRepo {
    void save(Asset asset);

    Optional<Asset> find(String id);

    /** The asset with this VIN, chassis or serial number, if any. */
    Optional<Asset> findBySerial(String serialNo);

    List<Asset> byStatus(Asset.Status status);

    /** The assets securing one loan or lease. */
    List<Asset> byContract(String contractId);

    void addPolicy(Policy policy);

    List<Policy> policies(String assetId);

    void addTitleEvent(TitleEvent event);

    /** Title changes of one asset, oldest first. */
    List<TitleEvent> titleEvents(String assetId);

    final class InMemory implements AssetRepo {
        private final Map<String, Asset> assets = new HashMap<>();
        private final List<Policy> policies = new ArrayList<>();
        private final List<TitleEvent> events = new ArrayList<>();

        @Override
        public synchronized void save(Asset a) {
            assets.put(a.id(), a);
        }

        @Override
        public synchronized Optional<Asset> find(String id) {
            return Optional.ofNullable(assets.get(id));
        }

        @Override
        public synchronized Optional<Asset> findBySerial(String serialNo) {
            return assets.values().stream().filter(a -> a.serialNo().equals(serialNo)).findFirst();
        }

        @Override
        public synchronized List<Asset> byStatus(Asset.Status status) {
            return assets.values().stream().filter(a -> a.status() == status).sorted(java.util.Comparator.comparing(Asset::id)).toList();
        }

        @Override
        public synchronized List<Asset> byContract(String contractId) {
            return assets.values().stream().filter(a -> contractId.equals(a.contractId()))
                    .sorted(java.util.Comparator.comparing(Asset::id)).toList();
        }

        @Override
        public synchronized void addPolicy(Policy p) {
            policies.add(p);
        }

        @Override
        public synchronized List<Policy> policies(String assetId) {
            return policies.stream().filter(p -> p.assetId().equals(assetId)).toList();
        }

        @Override
        public synchronized void addTitleEvent(TitleEvent e) {
            events.add(e);
        }

        @Override
        public synchronized List<TitleEvent> titleEvents(String assetId) {
            return events.stream().filter(e -> e.assetId().equals(assetId)).toList();
        }
    }
}
