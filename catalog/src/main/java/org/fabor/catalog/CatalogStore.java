package org.fabor.catalog;

import java.util.List;
import java.util.Optional;

/** Persistence port of the catalog. Published versions are append-only apart from the retired flag. */
public interface CatalogStore {
    void saveDraft(Draft draft);

    Optional<Draft> draft(String id);

    /** @throws IllegalStateException if the version already exists */
    void publish(PublishedVersion version);

    Optional<PublishedVersion> version(String product, int version);

    List<PublishedVersion> versions(String product);

    void markRetired(String product, int version);
}
