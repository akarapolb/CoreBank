package org.fabor.assets;

import java.time.LocalDate;

/** An insurance policy on an asset. {@code financed} means the premium was added to the customer's financing. */
public record Policy(String assetId, String insurer, String policyNo, LocalDate from, LocalDate to, long sumInsured,
                     long premium, boolean financed) {
    public Policy {
        if (insurer == null || insurer.isBlank() || policyNo == null || policyNo.isBlank()) {
            throw new IllegalArgumentException("A policy needs an insurer and a policy number");
        }
        if (from == null || to == null || to.isBefore(from)) {
            throw new IllegalArgumentException("A policy must end on or after the day it starts");
        }
        if (sumInsured <= 0 || premium < 0) {
            throw new IllegalArgumentException("Sum insured must be positive and the premium not negative");
        }
    }

    /** Both ends of the cover period count as covered. */
    public boolean covers(LocalDate day) {
        return !day.isBefore(from) && !day.isAfter(to);
    }
}
