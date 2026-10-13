package org.fabor.onboarding;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.fabor.decisioning.CreditDecision;
import org.fabor.decisioning.SanctionsScreener;
import org.fabor.deposit.DepositService;
import org.fabor.deposit.InMemoryDepositRepo;
import org.fabor.engine.product.ProductDefinition;
import org.fabor.engine.product.ProductLoader;
import org.fabor.ledger.application.LedgerService;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.testkit.InMemoryLedgerStore;
import org.fabor.lending.Loan;
import org.fabor.lending.LoanRepo;
import org.fabor.lending.LoanService;
import org.fabor.platform.money.Currency;
import org.fabor.platform.security.AuditLog;
import org.fabor.platform.security.ConsentRegistry;
import org.fabor.platform.security.KeyProvider;
import org.fabor.platform.security.PiiVault;
import org.fabor.platform.tenancy.TenantId;
import org.fabor.platform.time.BusinessCalendar;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OnboardingTest {
    static final TenantId T = new TenantId("bank-a");
    static final Instant NOW = Instant.parse("2026-01-15T00:00:00Z");
    static final LocalDate TODAY = LocalDate.of(2026, 1, 15);

    final List<String> detokenized = new ArrayList<>();
    Ports.PartyRepo parties;
    ConsentRegistry consents;
    AuditLog audit;
    OnboardingService onboarding;
    OriginationService origination;
    LedgerService ledger;
    boolean ekycPasses = true;
    Optional<Ports.BureauReport> bureauReport = Optional.of(new Ports.BureauReport(720, 0));

    static String read(String name) throws IOException {
        try (var in = OnboardingTest.class.getResourceAsStream(name)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    @BeforeEach
    void setUp() throws IOException {
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        ProductDefinition savings = ProductLoader.parse(read("/savings.yaml"));
        ProductDefinition loan = ProductLoader.parse(read("/personal-loan.yaml"));
        ledger = new LedgerService(new InMemoryLedgerStore(), clock);
        DepositService deposits = new DepositService(T, ledger, new InMemoryDepositRepo(),
                (c, v) -> c.equals(savings.product()) ? savings : null, clock);
        LoanService loans = new LoanService(T, ledger, new LoanRepo.InMemory(),
                (c, v) -> c.equals(loan.product()) ? loan : null, BusinessCalendar.monToFri(Set.of()));
        KeyProvider keys = new KeyProvider() {
            public String currentKeyId(TenantId t) { return "k1"; }
            public byte[] dataKey(TenantId t, String id) { byte[] k = new byte[32]; Arrays.fill(k, (byte) 3); return k; }
            public byte[] indexKey(TenantId t) { byte[] k = new byte[32]; Arrays.fill(k, (byte) 9); return k; }
        };
        PiiVault vault = new PiiVault(keys, Set.of(OnboardingService.PURPOSE_KYC, OnboardingService.PURPOSE_SCREENING),
                (t, tok, p, a) -> detokenized.add(a + ":" + p));
        parties = new Ports.PartyRepo.InMemory();
        consents = new ConsentRegistry();
        audit = new AuditLog();
        SanctionsScreener screener = new SanctionsScreener(List.of(
                new SanctionsScreener.Entry("OFAC", "Ivan Petrovich Sidorov", List.of(), null),
                new SanctionsScreener.Entry("UN", "Somchai Jaidee Prasert", List.of(), null)), 0.97, 0.88);
        onboarding = new OnboardingService(T, parties, vault, consents, (id, n, d, ref) ->
                new Ports.EkycResult(ekycPasses, ekycPasses ? 0.97 : 0.2, ekycPasses ? "ok" : "liveness check failed"),
                screener, deposits, audit, clock, savings.product());
        origination = new OriginationService(T, parties, vault, consents, id -> bureauReport, loans, audit, clock,
                CreditDecision.Policy.retailV1());
    }

    private Party register(String id, String name) {
        consents.grant(T, id, OnboardingService.PURPOSE_KYC, 1, NOW.minusSeconds(60), "APP");
        return onboarding.register(id, name, "1101700230678", "0812345678", LocalDate.of(1990, 6, 1), "doc-1");
    }

    private OriginationService.Application app(String id, long amount) {
        return new OriginationService.Application("A-" + id, "P" + id, "PERSONAL_LOAN_STD", 1, amount, 12, 916_800, 5_000_000, 500_000, 36, TODAY);
    }

    @Test
    void cleanCustomerIsOnboardedWithAccountAndTokenisedPii() {
        Party p = register("P1", "Anong Suksan");
        assertThat(p.status()).isEqualTo(Party.Status.ACTIVE);
        assertThat(p.depositAccountId()).isEqualTo("SAV-P1");
        assertThat(p.nationalIdToken()).startsWith("tok_national_id_").doesNotContain("1101700230678");
        assertThat(parties.find("P1")).contains(p);
        assertThat(audit.all()).extracting(AuditLog.Record::action).contains("ONBOARDING_ACTIVE");
        assertThat(audit.verify().ok()).isTrue();
        // registering again is a no-op
        assertThat(onboarding.register("P1", "Anong Suksan", "1101700230678", "0812345678", LocalDate.of(1990, 6, 1), "doc-1")).isEqualTo(p);
    }

    @Test
    void noConsentNoOnboarding() {
        assertThatThrownBy(() -> onboarding.register("P2", "Anong Suksan", "1101700230678", "0812345678", LocalDate.of(1990, 6, 1), "d"))
                .hasMessageContaining("Consent");
        assertThat(parties.find("P2")).isEmpty();
        assertThat(audit.all()).extracting(AuditLog.Record::action).contains("ONBOARDING_REFUSED");
    }

    @Test
    void failedEkycHitAndPossibleMatchPaths() {
        ekycPasses = false;
        assertThat(register("P3", "Anong Suksan").status()).isEqualTo(Party.Status.KYC_FAILED);
        ekycPasses = true;
        assertThat(register("P4", "Sidorov Ivan Petrovich").status()).isEqualTo(Party.Status.REJECTED);
        Party review = register("P5", "Somchai Jaidee Prasart");   // one letter off a listed name
        assertThat(review.status()).isEqualTo(Party.Status.UNDER_REVIEW);
        assertThat(review.depositAccountId()).isNull();
        Party released = onboarding.release("P5", "analyst-1");
        assertThat(released.status()).isEqualTo(Party.Status.ACTIVE);
        assertThat(audit.all()).extracting(AuditLog.Record::action).contains("SCREENING_CLEARED");
        assertThatThrownBy(() -> onboarding.release("P5", "analyst-1")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> onboarding.release("ZZ", "analyst-1")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void approvedLoanIsDisbursedIntoTheSavingsAccount() {
        register("P1", "Anong Suksan");
        consents.grant(T, "P1", OriginationService.PURPOSE_BUREAU, 1, NOW.minusSeconds(30), "APP");
        var out = origination.apply(app("1", 10_000_000), Currency.THB);
        assertThat(out.decision()).isEqualTo(CreditDecision.Outcome.APPROVE);
        Loan loan = out.loan();
        assertThat(loan.id()).isEqualTo("LN-A-1");
        assertThat(ledger.balance(T, new AccountId("dep:SAV-P1"), BalanceType.SETTLED, Currency.THB, TODAY).minor())
                .isEqualTo(10_000_000 - 100_000);
        assertThat(detokenized).contains("origination:KYC_PROCESSING");     // PII access was audited by the vault hook
        assertThat(audit.all()).extracting(AuditLog.Record::action).contains("CREDIT_DECISION_APPROVE", "LOAN_DISBURSED");
    }

    @Test
    void declinedApplicationsCreateNoLoanAndExplainWhy() {
        register("P1", "Anong Suksan");
        consents.grant(T, "P1", OriginationService.PURPOSE_BUREAU, 1, NOW.minusSeconds(30), "APP");
        bureauReport = Optional.of(new Ports.BureauReport(400, 3));
        var out = origination.apply(app("1", 10_000_000), Currency.THB);
        assertThat(out.decision()).isEqualTo(CreditDecision.Outcome.DECLINE);
        assertThat(out.loan()).isNull();
        assertThat(out.reasons()).extracting(CreditDecision.Reason::code).contains("BUREAU_SCORE_TOO_LOW", "RECENT_DELINQUENCIES");
        assertThat(ledger.balance(T, new AccountId("dep:SAV-P1"), BalanceType.SETTLED, Currency.THB, TODAY).minor()).isZero();
        // no bureau file at all: treated as a thin file, not an error
        bureauReport = Optional.empty();
        assertThat(origination.apply(app("1", 10_000_000), Currency.THB).decision()).isNotNull();
    }

    @Test
    void originationGuards() {
        assertThatThrownBy(() -> origination.apply(app("x", 1), Currency.THB)).isInstanceOf(IllegalArgumentException.class);
        Party review = register("P5", "Somchai Jaidee Prasart");
        assertThat(review.status()).isEqualTo(Party.Status.UNDER_REVIEW);
        assertThatThrownBy(() -> origination.apply(app("5", 1), Currency.THB)).hasMessageContaining("only active");
        register("P1", "Anong Suksan");
        assertThatThrownBy(() -> origination.apply(app("1", 10_000_000), Currency.THB)).hasMessageContaining("CREDIT_BUREAU");
        // consent withdrawn later blocks the next application
        consents.grant(T, "P1", OriginationService.PURPOSE_BUREAU, 1, NOW.minusSeconds(30), "APP");
        consents.withdraw(T, "P1", OriginationService.PURPOSE_BUREAU, NOW.minusSeconds(10), "APP");
        assertThatThrownBy(() -> origination.apply(app("1", 10_000_000), Currency.THB)).hasMessageContaining("CREDIT_BUREAU");
        assertThat(new BigDecimal("1")).isNotNull();
    }

    @Test
    void ageIsComputedFromDateOfBirthAtApplicationDate() {
        register("P1", "Anong Suksan");     // born 1 June 1990
        consents.grant(T, "P1", OriginationService.PURPOSE_BUREAU, 1, NOW.minusSeconds(30), "APP");
        // before the 1990 birthday in 2010 she is 19: below the minimum age, so the application is declined
        var young = new OriginationService.Application("A-y", "P1", "PERSONAL_LOAN_STD", 1, 10_000_000, 12, 916_800, 5_000_000,
                500_000, 36, LocalDate.of(2010, 3, 1));
        assertThat(origination.apply(young, Currency.THB).reasons()).extracting(CreditDecision.Reason::code).contains("AGE_BELOW_MINIMUM");
    }
}
