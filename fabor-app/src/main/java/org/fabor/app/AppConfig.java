package org.fabor.app;

import io.micrometer.core.instrument.MeterRegistry;
import java.time.Clock;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiFunction;
import javax.sql.DataSource;
import org.fabor.accounting.GlMapping;
import org.fabor.accounting.GlProjection;
import org.fabor.catalog.CatalogStore;
import org.fabor.catalog.MasterBuilder;
import org.fabor.decisioning.CreditDecision;
import org.fabor.decisioning.SanctionsScreener;
import org.fabor.deposit.DepositRepo;
import org.fabor.deposit.DepositService;
import org.fabor.engine.product.ProductDefinition;
import org.fabor.engine.product.ProductLoader;
import org.fabor.engine.product.ThailandHirePurchaseRules;
import org.fabor.engine.product.ThailandRetailRules;
import org.fabor.ledger.adapter.metrics.MeteredLedgerStore;
import org.fabor.ledger.adapter.persistence.GroupCommitLedgerStore;
import org.fabor.ledger.adapter.persistence.PostgresLedgerStore;
import org.fabor.ledger.adapter.web.LedgerGrpcService;
import org.fabor.ledger.application.LedgerService;
import org.fabor.ledger.application.LedgerStore;
import org.fabor.assets.AssetRepo;
import org.fabor.assets.AssetService;
import org.fabor.assets.DealerRepo;
import org.fabor.assets.DealerService;
import org.fabor.lending.Lease;
import org.fabor.lending.FloorPlanRepo;
import org.fabor.lending.FloorPlanService;
import org.fabor.lending.LeaseRepo;
import org.fabor.lending.LeaseService;
import org.fabor.lending.Loan;
import org.fabor.lending.LoanRepo;
import org.fabor.lending.LoanService;
import org.fabor.lending.MasterRepo;
import org.fabor.lending.MasterService;
import org.fabor.onboarding.OnboardingService;
import org.fabor.onboarding.OriginationService;
import org.fabor.onboarding.Ports;
import org.fabor.platform.security.AuditLog;
import org.fabor.platform.security.ConsentRegistry;
import org.fabor.platform.security.KeyProvider;
import org.fabor.platform.security.PiiVault;
import org.fabor.platform.tenancy.TenantId;
import org.fabor.platform.time.BusinessCalendar;
import org.fabor.scheduler.DueQueueStore;
import org.fabor.services.persistence.JdbcAuditStore;
import org.fabor.services.persistence.JdbcCatalogStore;
import org.fabor.services.persistence.JdbcConsentStore;
import org.fabor.services.persistence.JdbcDepositRepo;
import org.fabor.services.persistence.JdbcAssetRepo;
import org.fabor.services.persistence.JdbcDealerRepo;
import org.fabor.services.persistence.JdbcFloorPlanRepo;
import org.fabor.services.persistence.JdbcLeaseRepo;
import org.fabor.services.persistence.JdbcMasterRepo;
import org.fabor.services.persistence.JdbcLoanRepo;
import org.fabor.services.persistence.JdbcPartyRepo;
import org.fabor.services.persistence.JdbcVaultStore;
import org.fabor.scheduler.persistence.PostgresDueQueue;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.DependsOn;

/** Wires the services together. This is the only place that knows about concrete adapters. */
@Configuration
class AppConfig {

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    TenantId tenant(FaborProperties p) {
        return new TenantId(p.tenant());
    }

    @Bean(name = "migrations")
    Migrations migrations(DataSource ds) {
        return new Migrations(ds);
    }

    /** Development token mode only. In OIDC mode (the default) this filter does not exist. */
    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "fabor.auth-mode", havingValue = "token")
    FilterRegistrationBean<ApiTokenFilter> apiTokenFilter(FaborProperties p) {
        FilterRegistrationBean<ApiTokenFilter> r = new FilterRegistrationBean<>(new ApiTokenFilter(p.apiToken()));
        r.addUrlPatterns("/api/*");
        r.setOrder(org.springframework.core.Ordered.HIGHEST_PRECEDENCE);
        return r;
    }

    // ---- ledger
    @Bean(destroyMethod = "")
    @DependsOn("migrations")
    LedgerStore ledgerStore(DataSource ds, FaborProperties p, MeterRegistry registry) {
        PostgresLedgerStore base = new PostgresLedgerStore(ds);
        LedgerStore store = p.groupCommit() ? new GroupCommitLedgerStore(base, 4, 128, 300) : base;
        return new MeteredLedgerStore(store, registry);
    }

    @Bean
    LedgerService ledgerService(LedgerStore store, Clock clock) {
        return new LedgerService(store, clock);
    }

    @Bean
    GrpcServer grpcServer(FaborProperties p, LedgerService ledger,
                          org.springframework.beans.factory.ObjectProvider<org.springframework.security.oauth2.jwt.JwtDecoder> jwt) {
        return new GrpcServer(p.grpcPort(), new LedgerGrpcService(ledger), p.tokenMode() ? p.apiToken() : null,
                p.tokenMode() ? null : jwt.getObject());
    }

    // ---- security
    @Bean
    KeyProvider keyProvider(FaborProperties p, Clock clock) {
        if (p.keyProvider().equals("openbao")) {
            return new OpenBaoKeyProvider(p.openbaoUrl(), p.openbaoToken(), p.openbaoMount(), java.time.Duration.ofMinutes(5), clock);
        }
        return new ConfigKeyProvider(p.masterKey(), "k1");
    }

    @Bean
    @DependsOn("migrations")
    AuditLog auditLog(DataSource ds) {
        return new AuditLog(new JdbcAuditStore(ds));
    }

    @Bean
    PiiVault piiVault(DataSource ds, KeyProvider keys, AuditLog audit, Clock clock) {
        return new PiiVault(keys, Set.of(OnboardingService.PURPOSE_KYC, OnboardingService.PURPOSE_SCREENING),
                (t, token, purpose, actor) -> audit.append(clock.instant(), "SYSTEM", actor, null, "PII_DETOKENIZED",
                        token, "purpose=" + purpose), new JdbcVaultStore(ds));
    }

    @Bean
    ConsentRegistry consentRegistry(DataSource ds) {
        return new ConsentRegistry(new JdbcConsentStore(ds));
    }

    // ---- product catalog
    @Bean
    CatalogStore catalogStore(DataSource ds) {
        return new JdbcCatalogStore(ds);
    }

    @Bean
    MasterBuilder masterBuilder(CatalogStore store, Clock clock) {
        return new MasterBuilder(store, java.util.List.of(new ThailandRetailRules(), new ThailandHirePurchaseRules()),
                Set.of("PRODUCT", "RISK", "FINANCE", "COMPLIANCE"), clock);
    }

    /** Published versions are immutable, so resolved definitions can be cached forever. */
    @Bean
    BiFunction<String, Integer, ProductDefinition> products(CatalogStore store) {
        Map<String, ProductDefinition> cache = new ConcurrentHashMap<>();
        return (code, version) -> {
            String key = code + "@" + version;
            ProductDefinition cached = cache.get(key);
            if (cached != null) {
                return cached;
            }
            return store.version(code, version).map(v -> {
                ProductDefinition d = ProductLoader.parse(v.yaml());
                cache.put(key, d);
                return d;
            }).orElse(null);
        };
    }

    // ---- services
    @Bean
    DepositRepo depositRepo(DataSource ds, TenantId tenant) {
        return new JdbcDepositRepo(ds, tenant);
    }

    @Bean
    DepositService depositService(TenantId tenant, LedgerService ledger, DepositRepo repo,
                                  BiFunction<String, Integer, ProductDefinition> products, Clock clock) {
        return new DepositService(tenant, ledger, repo, products, clock);
    }

    @Bean
    LoanRepo loanRepo(DataSource ds, TenantId tenant) {
        return new JdbcLoanRepo(ds, tenant);
    }

    @Bean
    BusinessCalendar calendar() {
        return BusinessCalendar.monToFri(Set.of());
    }

    @Bean
    LoanService loanService(TenantId tenant, LedgerService ledger, LoanRepo repo,
                            BiFunction<String, Integer, ProductDefinition> products, BusinessCalendar calendar) {
        return new LoanService(tenant, ledger, repo, products, calendar);
    }

    @Bean
    LeaseRepo leaseRepo(DataSource ds, TenantId tenant) {
        return new JdbcLeaseRepo(ds, tenant);
    }

    @Bean
    LeaseService leaseService(TenantId tenant, LedgerService ledger, LeaseRepo repo, BusinessCalendar calendar) {
        return new LeaseService(tenant, ledger, repo, calendar);
    }

    @Bean
    FloorPlanRepo floorPlanRepo(DataSource ds, TenantId tenant) {
        return new JdbcFloorPlanRepo(ds, tenant);
    }

    @Bean
    FloorPlanService floorPlanService(TenantId tenant, LedgerService ledger, FloorPlanRepo repo, LoanRepo loans) {
        return new FloorPlanService(tenant, ledger, repo, loans);
    }

    @Bean
    MasterRepo masterRepo(DataSource ds, TenantId tenant) {
        return new JdbcMasterRepo(ds, tenant);
    }

    @Bean
    MasterService masterService(MasterRepo repo, LoanService loans, LoanRepo loanRepo) {
        return new MasterService(repo, loans, loanRepo);
    }

    @Bean
    AssetRepo assetRepo(DataSource ds, TenantId tenant) {
        return new JdbcAssetRepo(ds, tenant);
    }

    @Bean
    DealerRepo dealerRepo(DataSource ds, TenantId tenant) {
        return new JdbcDealerRepo(ds, tenant);
    }

    /** A loan is settled once closed; a lease once every period has been collected. */
    @Bean
    AssetService.ContractLookup contractLookup(LoanRepo loans, LeaseRepo leases) {
        return id -> loans.find(id).map(l -> new AssetService.ContractState(id, l.status() == Loan.Status.CLOSED))
                .or(() -> leases.find(id).map(l -> new AssetService.ContractState(id, l.status() == Lease.Status.COMPLETED)));
    }

    @Bean
    AssetService assetService(AssetRepo repo, AssetService.ContractLookup contracts) {
        return new AssetService(repo, contracts);
    }

    @Bean
    DealerService dealerService(TenantId tenant, LedgerService ledger, DealerRepo dealers, AssetRepo assets) {
        return new DealerService(tenant, ledger, dealers, assets);
    }

    @Bean
    Ports.PartyRepo partyRepo(DataSource ds, TenantId tenant) {
        return new JdbcPartyRepo(ds, tenant);
    }

    @Bean
    Ports.EkycProvider ekycProvider() {
        // Integration point: the pilot wires the national eKYC provider here. Until then nothing passes by default.
        return (id, name, dob, ref) -> new Ports.EkycResult(false, 0, "No eKYC provider configured");
    }

    @Bean
    Ports.CreditBureau creditBureau() {
        return id -> java.util.Optional.empty();   // integration point for the credit bureau (NCB)
    }

    @Bean
    SanctionsScreener sanctionsScreener() {
        return new SanctionsScreener(java.util.List.of(), 0.93, 0.85);   // lists are loaded by the compliance team
    }

    @Bean
    OnboardingService onboardingService(TenantId tenant, Ports.PartyRepo parties, PiiVault vault, ConsentRegistry consents,
                                        Ports.EkycProvider ekyc, SanctionsScreener screener, DepositService deposits,
                                        AuditLog audit, Clock clock) {
        return new OnboardingService(tenant, parties, vault, consents, ekyc, screener, deposits, audit, clock, "SAVINGS_STD");
    }

    @Bean
    OriginationService originationService(TenantId tenant, Ports.PartyRepo parties, PiiVault vault, ConsentRegistry consents,
                                          Ports.CreditBureau bureau, LoanService loans, AuditLog audit, Clock clock) {
        return new OriginationService(tenant, parties, vault, consents, bureau, loans, audit, clock,
                CreditDecision.Policy.retailV1());
    }

    // ---- accounting and scheduler
    @Bean
    GlProjection glProjection() {
        return new GlProjection(GlMapping.retailV1());
    }

    @Bean
    DueQueueStore dueQueue(DataSource ds) {
        return new PostgresDueQueue(ds);
    }
}
