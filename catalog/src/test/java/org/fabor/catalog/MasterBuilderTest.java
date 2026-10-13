package org.fabor.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import org.fabor.engine.product.ThailandRetailRules;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class MasterBuilderTest {
    private static final Set<String> ROLES = Set.of("PRODUCT", "RISK", "FINANCE", "COMPLIANCE");
    private final CatalogStore store = new InMemoryCatalogStore();
    private MasterBuilder mb;
    private String yaml;

    @BeforeEach
    void setUp() throws IOException {
        mb = new MasterBuilder(store, List.of(new ThailandRetailRules()), ROLES,
                Clock.fixed(Instant.parse("2026-02-01T00:00:00Z"), ZoneOffset.UTC));
        try (var in = getClass().getResourceAsStream("/personal-loan.yaml")) {
            yaml = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private Draft inReview() {
        Draft d = mb.createDraft("maya", yaml);
        return mb.submit(d.id(), "maya");
    }

    private void approveAll(String id) {
        mb.approve(id, "bob", "PRODUCT");
        mb.approve(id, "rita", "RISK");
        mb.approve(id, "fin", "FINANCE");
        mb.approve(id, "carl", "COMPLIANCE");
    }

    @Test
    void happyPathToPublishedImmutableVersion() {
        Draft d = inReview();
        assertThat(d.status()).isEqualTo(Draft.Status.IN_REVIEW);
        assertThat(store.openDrafts()).extracting(Draft::id).containsExactly(d.id());
        approveAll(d.id());
        PublishedVersion v = mb.publish(d.id(), "maya");
        assertThat(v.product()).isEqualTo("PERSONAL_LOAN_STD");
        assertThat(v.version()).isEqualTo(1);
        assertThat(v.approvals()).containsOnlyKeys(ROLES.toArray(String[]::new));
        assertThat(v.goldenHash()).isNotEmpty();
        assertThat(store.openDrafts()).isEmpty();
        assertThat(v.publishedAt()).isEqualTo(Instant.parse("2026-02-01T00:00:00Z"));
        assertThat(store.version("PERSONAL_LOAN_STD", 1)).isPresent();
        assertThat(store.draft(d.id()).orElseThrow().status()).isEqualTo(Draft.Status.PUBLISHED);
        // version 1 exists: the next draft must be version 2, and a published draft cannot be edited
        assertThatThrownBy(() -> mb.createDraft("maya", yaml)).hasMessageContaining("must be 2");
        assertThatThrownBy(() -> mb.updateDraft(d.id(), "maya", yaml)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void makerCheckerRules() {
        Draft d = inReview();
        assertThatThrownBy(() -> mb.approve(d.id(), "maya", "PRODUCT")).hasMessageContaining("author");
        mb.approve(d.id(), "bob", "PRODUCT");
        assertThatThrownBy(() -> mb.approve(d.id(), "rita", "PRODUCT")).hasMessageContaining("already approved");
        assertThatThrownBy(() -> mb.approve(d.id(), "bob", "RISK")).hasMessageContaining("different person");
        assertThatThrownBy(() -> mb.approve(d.id(), "x", "LEGAL")).hasMessageContaining("Unknown approval role");
        assertThatThrownBy(() -> mb.publish(d.id(), "maya")).hasMessageContaining("Missing approvals");
        assertThatThrownBy(() -> mb.submit(d.id(), "maya")).hasMessageContaining("IN_REVIEW");
        Draft other = mb.createDraft("zed", yaml.replace("version: 1", "version: 1"));
        assertThatThrownBy(() -> mb.submit(other.id(), "maya")).hasMessageContaining("Only the author");
        assertThatThrownBy(() -> mb.approve(other.id(), "bob", "PRODUCT")).hasMessageContaining("not in review");
        assertThatThrownBy(() -> mb.publish(other.id(), "maya")).hasMessageContaining("not in review");
    }

    @Test
    void editAfterSubmissionVoidsApprovals() {
        Draft d = inReview();
        mb.approve(d.id(), "bob", "PRODUCT");
        Draft edited = mb.updateDraft(d.id(), "maya", yaml.replace("rate: 0.18", "rate: 0.17"));
        assertThat(edited.status()).isEqualTo(Draft.Status.DRAFT);
        assertThat(edited.approvals()).isEmpty();
        assertThat(edited.yamlHash()).isNotEqualTo(d.yamlHash());
        assertThatThrownBy(() -> mb.approve(d.id(), "rita", "RISK")).hasMessageContaining("not in review");
        assertThatThrownBy(() -> mb.updateDraft(d.id(), "maya", yaml.replace("PERSONAL_LOAN_STD", "OTHER_PRODUCT")))
                .hasMessageContaining("cannot change");
        assertThatThrownBy(() -> mb.updateDraft(d.id(), "maya", yaml.replace("version: 1", "version: 3")))
                .hasMessageContaining("cannot change");
    }

    @Test
    void textChangedAfterReviewCannotBePublished() {
        Draft d = inReview();
        approveAll(d.id());
        // simulate tampering with the stored draft behind the builder's back
        Draft tampered = new Draft(d.id(), d.product(), d.version(), d.author(), yaml.replace("0.18", "0.01"),
                MasterBuilder.hash(yaml.replace("0.18", "0.01")), Draft.Status.IN_REVIEW, d.reviewedHash(),
                store.draft(d.id()).orElseThrow().approvals());
        store.saveDraft(tampered);
        assertThatThrownBy(() -> mb.publish(d.id(), "maya")).hasMessageContaining("changed after review");
    }

    @Test
    void checksBlockBadDraftsAndShowFindings() {
        Draft bad = mb.createDraft("maya", yaml.replace("rate: 0.18", "rate: 0.30"));
        ReviewReport r = mb.check(bad.id());
        assertThat(r.ok()).isFalse();
        assertThat(r.issues()).anyMatch(i -> i.message().contains("[TH-RETAIL-v1]"));
        assertThat(r.scenarios()).isEmpty();
        assertThatThrownBy(() -> mb.submit(bad.id(), "maya")).hasMessageContaining("errors");
        Draft broken = mb.createDraft("maya", yaml.replace("rate_type: FIXED", "rate_type: FLAT"));
        assertThat(mb.check(broken.id()).ok()).isFalse();
    }

    @Test
    void reportCarriesStandardScenariosAndStableHash() {
        Draft d = mb.createDraft("maya", yaml);
        ReviewReport a = mb.check(d.id());
        ReviewReport b = mb.check(d.id());
        assertThat(a.ok()).isTrue();
        assertThat(a.scenarios()).hasSize(4);
        assertThat(a.goldenHash()).isEqualTo(b.goldenHash()).hasSize(64);
        assertThat(a.yamlHash()).isEqualTo(d.yamlHash());
    }

    @Test
    void simulationFailureIsReportedNotThrown() {
        // principal limits that make the sample unquotable under the term rule
        Draft d = mb.createDraft("maya", yaml.replace("allowed: [6, 12, 24, 36, 48, 60]", "allowed: [7]")
                .replace("default: 50000", "default: 600000").replace("max: 500000", "max: 900000")
                .replace("rate: 0.18", "rate: 0.18"));
        ReviewReport r = mb.check(d.id());
        assertThat(r.scenarios()).isNotNull();
    }

    @Test
    void versionsRetireAndDiff() {
        Draft d = inReview();
        approveAll(d.id());
        mb.publish(d.id(), "maya");
        mb.retire("PERSONAL_LOAN_STD", 1);
        assertThat(store.version("PERSONAL_LOAN_STD", 1).orElseThrow().retired()).isTrue();
        assertThatThrownBy(() -> mb.retire("PERSONAL_LOAN_STD", 9)).isInstanceOf(IllegalArgumentException.class);
        Draft v2 = mb.createDraft("maya", yaml.replace("version: 1", "version: 2").replace("rate: 0.18", "rate: 0.16"));
        String diff = mb.diff("PERSONAL_LOAN_STD", 1, v2.id());
        assertThat(diff).contains("- version: 1").contains("+ version: 2").contains("- ", "+   rate: 0.16".replace("+   ", "+   "));
        assertThat(store.versions("PERSONAL_LOAN_STD")).hasSize(1);
        assertThatThrownBy(() -> mb.diff("NOPE", 1, v2.id())).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void duplicatePublishAndMissingDraftAndConfig() {
        assertThatThrownBy(() -> mb.submit("nope", "maya")).hasMessageContaining("No such draft");
        assertThatThrownBy(() -> new MasterBuilder(store, List.of(), Set.of(), Clock.systemUTC()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> mb.createDraft("maya", "product: ONLY")).hasMessageContaining("required");
        Draft d = inReview();
        approveAll(d.id());
        PublishedVersion v = mb.publish(d.id(), "maya");
        assertThatThrownBy(() -> store.publish(v)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void lineDiffHandlesTrailingChanges() {
        assertThat(LineDiff.diff("a\nb", "a\nb\nc")).contains("+ c");
        assertThat(LineDiff.diff("a\nb\nc", "a")).contains("- b").contains("- c");
        assertThat(LineDiff.diff("x", "y")).contains("- x").contains("+ y");
    }

    @Test
    void sampleFallbacksForParametersAndDeposits() {
        // no parameters block: sample is 50,000 over 12 months
        Draft noParams = mb.createDraft("maya", yaml.replaceAll("(?s)parameters:.*?pricing:", "pricing:"));
        assertThat(mb.check(noParams.id()).scenarios()).hasSize(4);
        // principal with only a minimum, term as a range
        Draft rangeTerm = mb.createDraft("maya2", yaml.replace(", default: 50000", "")
                .replace("allowed: [6, 12, 24, 36, 48, 60]", "min: 6, max: 60"));
        assertThat(mb.check(rangeTerm.id()).scenarios()).hasSize(4);
        // principal with neither default nor minimum, term parameter with neither allowed nor min
        Draft loose = mb.createDraft("maya3", yaml.replace("{ min: 10000, max: 500000, default: 50000 }", "{ max: 500000 }")
                .replace("{ allowed: [6, 12, 24, 36, 48, 60] }", "{ max: 60 }"));
        assertThat(mb.check(loose.id()).scenarios()).hasSize(4);
        // deposit products have no schedule: checks pass, nothing to simulate yet
        Draft dep = mb.createDraft("maya4", "product: SAVINGS_BASIC\nversion: 1\nfamily: DEPOSIT\ncurrency: THB\n"
                + "pricing: { rate_type: FIXED, rate: 0.01 }\naccounting: { gl_mapping: dep_th }\n");
        ReviewReport r = mb.check(dep.id());
        assertThat(r.ok()).isTrue();
        assertThat(r.scenarios()).isEmpty();
        Draft sub = mb.submit(dep.id(), "maya4");
        assertThat(sub.status()).isEqualTo(Draft.Status.IN_REVIEW);
        assertThat(store.versions("SAVINGS_BASIC")).isEmpty();
        assertThat(store.version("SAVINGS_BASIC", 1)).isEmpty();
        assertThat(store.draft("none")).isEmpty();
    }

    @Test
    void warningsDoNotBlockAndReportHasHash() {
        Draft d = mb.createDraft("maya", "product: SOME_LOAN\nversion: 1\nfamily: LOAN\ncurrency: THB\n"
                + "pricing: { rate_type: FIXED, rate: 0.1 }\nschedule: { method: ANNUITY, frequency: MONTHLY }\n"
                + "repayment_waterfall: [INTEREST_DUE, PRINCIPAL_DUE]\naccounting: { gl_mapping: x }\n");
        ReviewReport r = mb.check(d.id());
        assertThat(r.ok()).isTrue();
        assertThat(r.issues()).anyMatch(i -> i.severity() == org.fabor.engine.product.Issue.Severity.WARNING);
        assertThat(new ReviewReport(List.of(), List.of(), "", "").ok()).isTrue();
        // a second approver trying the same role after publish prerequisites: unknown draft id for update
        assertThatThrownBy(() -> mb.updateDraft("none", "x", yaml)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> mb.updateDraft(d.id(), "x", "product: SOME_LOAN")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void checksThatFailAtPublishTimeStopThePublish() {
        Draft d = inReview();
        approveAll(d.id());
        // a rule pack that rejects everything appears after approval (rule pack upgrade)
        MasterBuilder stricter = new MasterBuilder(store, List.of(new org.fabor.engine.product.RulePack() {
            public String id() { return "STRICT"; }
            public List<org.fabor.engine.product.Issue> check(org.fabor.engine.product.ProductDefinition p) {
                return List.of(org.fabor.engine.product.Issue.error("x", "no"));
            }
        }), ROLES, Clock.systemUTC());
        assertThatThrownBy(() -> stricter.publish(d.id(), "maya")).hasMessageContaining("no longer pass");
    }
}
