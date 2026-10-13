package org.fabor.catalog;

import java.util.Map;

/**
 * A product version being worked on. {@code reviewedHash} is the hash of the YAML that passed the checks when
 * it was submitted; any later edit changes {@code yamlHash} and sends the draft back to DRAFT.
 */
public record Draft(String id, String product, int version, String author, String yaml, String yamlHash,
                    Status status, String reviewedHash, Map<String, String> approvals) {
    public enum Status { DRAFT, IN_REVIEW, PUBLISHED }

    public Draft withStatus(Status s) {
        return new Draft(id, product, version, author, yaml, yamlHash, s, reviewedHash, approvals);
    }
}
