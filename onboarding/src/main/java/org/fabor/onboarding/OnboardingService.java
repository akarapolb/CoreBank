package org.fabor.onboarding;

import java.time.Clock;
import java.time.LocalDate;
import org.fabor.decisioning.SanctionsScreener;
import org.fabor.deposit.DepositService;
import org.fabor.platform.security.AuditLog;
import org.fabor.platform.security.ConsentRegistry;
import org.fabor.platform.security.PiiVault;
import org.fabor.platform.tenancy.TenantId;

/**
 * Opens a customer: consent, tokenise PII, eKYC, sanctions screening, then a savings account. Every step is
 * audited and the outcome is explicit. Retrying with the same party id is safe: an existing party is returned
 * unchanged. Designed to run as a workflow; each step is idempotent.
 */
public final class OnboardingService {
    public static final String PURPOSE_KYC = "KYC_PROCESSING";
    public static final String PURPOSE_SCREENING = "SCREENING";

    private final TenantId tenant;
    private final Ports.PartyRepo parties;
    private final PiiVault vault;
    private final ConsentRegistry consents;
    private final Ports.EkycProvider ekyc;
    private final SanctionsScreener screener;
    private final DepositService deposits;
    private final AuditLog audit;
    private final Clock clock;
    private final String savingsProduct;

    public OnboardingService(TenantId tenant, Ports.PartyRepo parties, PiiVault vault, ConsentRegistry consents,
                             Ports.EkycProvider ekyc, SanctionsScreener screener, DepositService deposits, AuditLog audit,
                             Clock clock, String savingsProduct) {
        this.tenant = tenant;
        this.parties = parties;
        this.vault = vault;
        this.consents = consents;
        this.ekyc = ekyc;
        this.screener = screener;
        this.deposits = deposits;
        this.audit = audit;
        this.clock = clock;
        this.savingsProduct = savingsProduct;
    }

    public Party register(String partyId, String fullName, String nationalId, String phone, LocalDate dob, String documentRef) {
        var existing = parties.find(partyId);
        if (existing.isPresent()) {
            return existing.get();
        }
        if (!consents.isGranted(tenant, partyId, PURPOSE_KYC, 1, clock.instant())) {
            audit("ONBOARDING_REFUSED", partyId, "no KYC consent");
            throw new IllegalStateException("Consent for " + PURPOSE_KYC + " is required before onboarding");
        }
        String nameTok = vault.tokenize(tenant, "name", fullName);
        String idTok = vault.tokenize(tenant, "national_id", nationalId);
        String phoneTok = vault.tokenize(tenant, "phone", phone);
        Party p = new Party(partyId, nameTok, idTok, phoneTok, dob, Party.Status.KYC_FAILED, null);

        Ports.EkycResult k = ekyc.verify(nationalId, fullName, dob, documentRef);
        if (!k.passed()) {
            return finish(p.with(Party.Status.KYC_FAILED, null), "eKYC failed: " + k.reason());
        }
        SanctionsScreener.Result s = screener.screen(fullName, dob);
        switch (s.verdict()) {
            case HIT:
                return finish(p.with(Party.Status.REJECTED, null), "sanctions hit on " + s.matches().get(0).listId());
            case POSSIBLE_MATCH:
                return finish(p.with(Party.Status.UNDER_REVIEW, null), "possible sanctions match for analyst review");
            default:
                break;
        }
        String account = "SAV-" + partyId;
        deposits.open(account, partyId, savingsProduct, 1);
        return finish(p.with(Party.Status.ACTIVE, account), "onboarded");
    }

    /** An analyst clears a possible match. Only parties under review can be released. */
    public Party release(String partyId, String analyst) {
        Party p = parties.find(partyId).orElseThrow(() -> new IllegalArgumentException("No such party " + partyId));
        if (p.status() != Party.Status.UNDER_REVIEW) {
            throw new IllegalStateException("Party is " + p.status() + ", not under review");
        }
        String account = "SAV-" + partyId;
        deposits.open(account, partyId, savingsProduct, 1);
        Party active = p.with(Party.Status.ACTIVE, account);
        parties.save(active);
        audit.append(clock.instant(), "HUMAN", analyst, null, "SCREENING_CLEARED", partyId, "possible match released");
        return active;
    }

    private Party finish(Party p, String detail) {
        parties.save(p);
        audit("ONBOARDING_" + p.status(), p.id(), detail);
        return p;
    }

    private void audit(String action, String partyId, String detail) {
        audit.append(clock.instant(), "SYSTEM", "onboarding", null, action, partyId, detail);
    }
}
