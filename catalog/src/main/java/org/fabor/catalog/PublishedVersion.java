package org.fabor.catalog;

import java.time.Instant;
import java.util.Map;

/** An immutable product version. Contracts pin to (product, version). */
public record PublishedVersion(String product, int version, String yaml, String yamlHash, String goldenHash,
                               String author, Map<String, String> approvals, String publishedBy, Instant publishedAt,
                               boolean retired) {
    public PublishedVersion retire() {
        return new PublishedVersion(product, version, yaml, yamlHash, goldenHash, author, approvals, publishedBy,
                publishedAt, true);
    }
}
