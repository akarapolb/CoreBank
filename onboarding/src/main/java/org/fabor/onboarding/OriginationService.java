package org.fabor.onboarding;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import org.fabor.decisioning.CreditDecision;
import org.fabor.lending.Loan;
import org.fabor.lending.LoanService;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.security.AuditLog;
import org.fabor.platform.security.ConsentRegistry;
import org.fabor.platform.security.PiiVault;
import org.fabor.platform.tenancy.TenantId;

/**
 * Personal loan origination: active customer, bureau consent, bureau lookup, explainable decision, disbursement
 * into the customer's savings account. Declines and referrals never create a loan and always carry reasons.
 */
public final class OriginationService {
    public static final String PURPOSE_BUREAU = "CREDIT_BUREAU";

    public record Application(String applicationId, String partyId, String productCode, int productVersion, long amountMinor,
                              int termMonths, long monthlyInstalmentMinor, long monthlyIncomeMinor, long existingDebtMinor,
                              int monthsAtEmployer, LocalDate asOf) { }

    public record Outcome(CreditDecision.Outcome decision, int score, List<CreditDecision.Reason> reasons, Loan loan) { }

    private final TenantId tenant;
    private final Ports.PartyRepo parties;
    private final PiiVault vault;
    private final ConsentRegistry consents;
    private final Ports.CreditBureau bureau;
    private final LoanService loans;
    private final AuditLog audit;
    private final Clock clock;
    private final CreditDecision.Policy policy;

    public OriginationService(TenantId tenant, Ports.PartyRepo parties, PiiVault vault, ConsentRegistry consents,
                              Ports.CreditBureau bureau, LoanService loans, AuditLog audit, Clock clock,
                              CreditDecision.Policy policy) {
        this.tenant = tenant;
        this.parties = parties;
        this.vault = vault;
        this.consents = consents;
        this.bureau = bureau;
        this.loans = loans;
        this.audit = audit;
        this.clock = clock;
        this.policy = policy;
    }

    public Outcome apply(Application a, Currency currency) {
        Party p = parties.find(a.partyId()).orElseThrow(() -> new IllegalArgumentException("No such party " + a.partyId()));
        if (p.status() != Party.Status.ACTIVE) {
            throw new IllegalStateException("Party is " + p.status() + "; only active customers can borrow");
        }
        if (!consents.isGranted(tenant, p.id(), PURPOSE_BUREAU, 1, clock.instant())) {
            throw new IllegalStateException("Consent for " + PURPOSE_BUREAU + " is required to check credit");
        }
        String nationalId = vault.detokenize(tenant, p.nationalIdToken(), OnboardingService.PURPOSE_KYC, "origination")
                .orElseThrow(() -> new IllegalStateException("National id missing from vault"));
        var report = bureau.lookup(nationalId);
        int age = a.asOf().getYear() - p.dateOfBirth().getYear()
                - (a.asOf().getDayOfYear() < p.dateOfBirth().getDayOfYear() ? 1 : 0);
        var applicant = new CreditDecision.Applicant(age, a.monthlyIncomeMinor(), a.existingDebtMinor(),
                report.map(Ports.BureauReport::score).orElse(null), report.map(Ports.BureauReport::delinquencies12m).orElse(0),
                a.monthsAtEmployer());
        var result = CreditDecision.decide(applicant, new CreditDecision.Request(a.amountMinor(), a.termMonths(),
                a.monthlyInstalmentMinor()), policy);
        audit.append(clock.instant(), "SYSTEM", "origination", null, "CREDIT_DECISION_" + result.outcome(), a.applicationId(),
                "score=" + result.score() + " reasons=" + result.reasons().stream().map(CreditDecision.Reason::code).toList());
        Loan loan = null;
        if (result.outcome() == CreditDecision.Outcome.APPROVE) {
            loan = loans.disburse("LN-" + a.applicationId(), p.id(), a.productCode(), a.productVersion(),
                    Money.ofMinor(result.approvedAmount(), currency), a.termMonths(), a.asOf(), p.depositAccountId());
            audit.append(clock.instant(), "SYSTEM", "origination", null, "LOAN_DISBURSED", loan.id(), "applicant " + p.id());
        }
        return new Outcome(result.outcome(), result.score(), result.reasons(), loan);
    }
}
