package org.fabor.onboarding;

import java.time.LocalDate;

/** A customer. Name, national id and phone live only in the PII vault; the party holds tokens. */
public record Party(String id, String nameToken, String nationalIdToken, String phoneToken, LocalDate dateOfBirth,
                    Status status, String depositAccountId) {
    public enum Status { ACTIVE, UNDER_REVIEW, REJECTED, KYC_FAILED }

    public Party with(Status s, String account) {
        return new Party(id, nameToken, nationalIdToken, phoneToken, dateOfBirth, s, account);
    }
}
