package org.fabor.catalog;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class InMemoryCatalogStore implements CatalogStore {
    private final Map<String, Draft> drafts = new HashMap<>();
    private final Map<String, PublishedVersion> published = new HashMap<>();

    @Override
    public synchronized void saveDraft(Draft d) {
        drafts.put(d.id(), d);
    }

    @Override
    public synchronized Optional<Draft> draft(String id) {
        return Optional.ofNullable(drafts.get(id));
    }

    @Override
    public synchronized List<Draft> openDrafts() {
        return drafts.values().stream().filter(d -> d.status() != Draft.Status.PUBLISHED).sorted(Comparator.comparing(Draft::id)).toList();
    }

    @Override
    public synchronized void publish(PublishedVersion v) {
        if (published.putIfAbsent(v.product() + "@" + v.version(), v) != null) {
            throw new IllegalStateException("Version already published: " + v.product() + " v" + v.version());
        }
    }

    @Override
    public synchronized Optional<PublishedVersion> version(String product, int version) {
        return Optional.ofNullable(published.get(product + "@" + version));
    }

    @Override
    public synchronized List<PublishedVersion> versions(String product) {
        List<PublishedVersion> out = new ArrayList<>();
        for (PublishedVersion v : published.values()) {
            if (v.product().equals(product)) {
                out.add(v);
            }
        }
        out.sort(Comparator.comparingInt(PublishedVersion::version));
        return out;
    }

    @Override
    public synchronized void markRetired(String product, int version) {
        published.computeIfPresent(product + "@" + version, (k, v) -> v.retire());
    }
}
