package org.fabor.catalog;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.fabor.engine.product.Issue;
import org.fabor.engine.product.ProductDefinition;
import org.fabor.engine.product.ProductLoader;
import org.fabor.engine.product.ProductValidator;
import org.fabor.engine.product.RulePack;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.time.BusinessCalendar;
import org.fabor.simulator.Golden;
import org.fabor.simulator.ProductSimulator;
import org.fabor.simulator.ScenarioResult;

/**
 * The guided path from an idea to a published product version. It never bypasses the engine: a draft is an
 * ordinary product definition, checked by the validator and the rule packs, simulated through the standard
 * scenarios, and approved by every required role before it becomes an immutable version.
 *
 * <p>Controls: the author cannot approve; each required role approves once, by a different person; any edit
 * after submission voids the approvals; publishing re-checks that the approved text is the text published.
 */
public final class MasterBuilder {
    private final CatalogStore store;
    private final List<RulePack> rulePacks;
    private final Set<String> requiredRoles;
    private final Clock clock;

    public MasterBuilder(CatalogStore store, List<RulePack> rulePacks, Set<String> requiredRoles, Clock clock) {
        if (requiredRoles.isEmpty()) {
            throw new IllegalArgumentException("At least one approval role is required");
        }
        this.store = store;
        this.rulePacks = List.copyOf(rulePacks);
        this.requiredRoles = Set.copyOf(requiredRoles);
        this.clock = clock;
    }

    public Draft createDraft(String actor, String yaml) {
        ProductDefinition d = ProductLoader.parse(yaml);
        if (d.product() == null || d.version() == null) {
            throw new IllegalArgumentException("product and version are required");
        }
        int expected = store.versions(d.product()).stream().mapToInt(PublishedVersion::version).max().orElse(0) + 1;
        if (d.version() != expected) {
            throw new IllegalArgumentException("Next version of " + d.product() + " must be " + expected + ", not " + d.version());
        }
        Draft draft = new Draft(UUID.randomUUID().toString(), d.product(), d.version(), actor, yaml, hash(yaml),
                Draft.Status.DRAFT, null, Map.of());
        store.saveDraft(draft);
        return draft;
    }

    /** Edits the text. Voids any review in progress: the draft returns to DRAFT with no approvals. */
    public Draft updateDraft(String id, String actor, String yaml) {
        Draft old = load(id);
        if (old.status() == Draft.Status.PUBLISHED) {
            throw new IllegalStateException("Published versions are immutable; create a new version");
        }
        ProductDefinition d = ProductLoader.parse(yaml);
        if (!old.product().equals(d.product()) || d.version() == null || d.version() != old.version()) {
            throw new IllegalArgumentException("Product code and version cannot change in a draft");
        }
        Draft next = new Draft(old.id(), old.product(), old.version(), old.author(), yaml, hash(yaml), Draft.Status.DRAFT,
                null, Map.of());
        store.saveDraft(next);
        return next;
    }

    /** Validator, rule packs and the standard scenarios on a representative sample. */
    public ReviewReport check(String id) {
        Draft draft = load(id);
        ProductDefinition d = ProductLoader.parse(draft.yaml());
        List<Issue> issues = new ArrayList<>(ProductValidator.validate(d));
        for (RulePack p : rulePacks) {
            for (Issue i : p.check(d)) {
                issues.add(new Issue(i.severity(), i.path(), "[" + p.id() + "] " + i.message()));
            }
        }
        List<ScenarioResult> results = List.of();
        if (ProductValidator.ok(issues) && d.schedule() != null) {
            try {
                var sample = sample(d);
                results = ProductSimulator.run(d, sample.principal(), sample.term(), LocalDate.of(2026, 1, 15),
                        BusinessCalendar.monToFri(Set.of()), ProductSimulator.standardScenarios(sample.term()));
            } catch (IllegalArgumentException e) {
                issues.add(Issue.error("simulation", "Simulation failed: " + e.getMessage()));
            }
        }
        return new ReviewReport(List.copyOf(issues), results, hash(Golden.render(results)),
                draft.yamlHash());
    }

    public Draft submit(String id, String actor) {
        Draft d = load(id);
        if (!actor.equals(d.author())) {
            throw new IllegalStateException("Only the author can submit a draft");
        }
        if (d.status() != Draft.Status.DRAFT) {
            throw new IllegalStateException("Draft is " + d.status());
        }
        ReviewReport report = check(id);
        if (!report.ok()) {
            throw new IllegalStateException("Draft has errors: " + report.issues().stream()
                    .filter(i -> i.severity() == Issue.Severity.ERROR).map(i -> i.path() + ": " + i.message()).toList());
        }
        Draft next = new Draft(d.id(), d.product(), d.version(), d.author(), d.yaml(), d.yamlHash(), Draft.Status.IN_REVIEW,
                d.yamlHash(), Map.of());
        store.saveDraft(next);
        return next;
    }

    public Draft approve(String id, String actor, String role) {
        Draft d = load(id);
        if (d.status() != Draft.Status.IN_REVIEW) {
            throw new IllegalStateException("Draft is not in review");
        }
        if (!requiredRoles.contains(role)) {
            throw new IllegalArgumentException("Unknown approval role " + role + "; required: " + requiredRoles);
        }
        if (actor.equals(d.author())) {
            throw new IllegalStateException("The author cannot approve their own product");
        }
        if (d.approvals().containsKey(role)) {
            throw new IllegalStateException("Role " + role + " has already approved");
        }
        if (d.approvals().containsValue(actor)) {
            throw new IllegalStateException(actor + " has already approved for another role; each role needs a different person");
        }
        Map<String, String> approvals = new LinkedHashMap<>(d.approvals());
        approvals.put(role, actor);
        Draft next = new Draft(d.id(), d.product(), d.version(), d.author(), d.yaml(), d.yamlHash(), d.status(),
                d.reviewedHash(), Map.copyOf(approvals));
        store.saveDraft(next);
        return next;
    }

    public PublishedVersion publish(String id, String actor) {
        Draft d = load(id);
        if (d.status() != Draft.Status.IN_REVIEW) {
            throw new IllegalStateException("Draft is not in review");
        }
        if (!d.approvals().keySet().containsAll(requiredRoles)) {
            throw new IllegalStateException("Missing approvals: " + diff(requiredRoles, d.approvals().keySet()));
        }
        if (!d.yamlHash().equals(d.reviewedHash())) {
            throw new IllegalStateException("The text changed after review");
        }
        ReviewReport report = check(id);
        if (!report.ok()) {
            throw new IllegalStateException("Checks no longer pass");
        }
        PublishedVersion v = new PublishedVersion(d.product(), d.version(), d.yaml(), d.yamlHash(), report.goldenHash(),
                d.author(), d.approvals(), actor, clock.instant(), false);
        store.publish(v);
        store.saveDraft(d.withStatus(Draft.Status.PUBLISHED));
        return v;
    }

    /** Stops new contracts from opening on a version; existing contracts keep their pinned version. */
    public void retire(String product, int version) {
        store.version(product, version).orElseThrow(() -> new IllegalArgumentException("No such version"));
        store.markRetired(product, version);
    }

    /** Line diff of the draft against a published version, for the approval screen. */
    public String diff(String product, int fromVersion, String draftId) {
        String before = store.version(product, fromVersion).orElseThrow(() -> new IllegalArgumentException("No such version")).yaml();
        return LineDiff.diff(before, load(draftId).yaml());
    }

    private Draft load(String id) {
        return store.draft(id).orElseThrow(() -> new IllegalArgumentException("No such draft " + id));
    }

    private static Set<String> diff(Set<String> a, Set<String> b) {
        Set<String> out = new java.util.TreeSet<>(a);
        out.removeAll(b);
        return out;
    }

    private record Sample(Money principal, int term) { }

    private static Sample sample(ProductDefinition d) {
        var p = d.parameters() == null ? null : d.parameters().get("principal");
        java.math.BigDecimal amount = p == null ? new java.math.BigDecimal("50000")
                : p.defaultValue() != null ? p.defaultValue() : p.min() != null ? p.min() : new java.math.BigDecimal("50000");
        var t = d.parameters() == null ? null : d.parameters().get("term_months");
        int term = t == null ? 12 : t.allowed() != null && !t.allowed().isEmpty() ? t.allowed().get(0).intValue()
                : t.min() != null ? t.min().intValue() : 12;
        return new Sample(Money.of(amount, Currency.of(d.currency())), term);
    }

    static String hash(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
