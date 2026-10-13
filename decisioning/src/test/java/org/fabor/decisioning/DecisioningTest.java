package org.fabor.decisioning;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import org.fabor.decisioning.CreditDecision.Applicant;
import org.fabor.decisioning.CreditDecision.Outcome;
import org.fabor.decisioning.CreditDecision.Policy;
import org.fabor.decisioning.CreditDecision.Request;
import org.fabor.decisioning.FraudScorer.Action;
import org.fabor.decisioning.SanctionsScreener.Verdict;
import org.junit.jupiter.api.Test;

class DecisioningTest {
    static final Policy P = Policy.retailV1();
    static final Request REQ = new Request(10_000_000, 24, 500_000);   // 100,000 over 24 months, 5,000/month

    static Applicant good() {
        return new Applicant(35, 5_000_000, 500_000, 720, 0, 36);      // 50,000/month income
    }

    private static List<String> codes(CreditDecision.Result r) {
        return r.reasons().stream().map(CreditDecision.Reason::code).toList();
    }

    // ---- credit
    @Test
    void goodApplicantIsApprovedWithPositiveReasonsFirst() {
        var r = CreditDecision.decide(good(), REQ, P);
        assertThat(r.outcome()).isEqualTo(Outcome.APPROVE);
        assertThat(r.approvedAmount()).isEqualTo(10_000_000);
        assertThat(r.score()).isGreaterThanOrEqualTo(P.approveScore());
        assertThat(r.reasons().get(0).points()).isPositive();
        assertThat(codes(r)).contains("BUREAU", "DELINQUENCY", "DEBT_TO_INCOME", "STABILITY");
    }

    @Test
    void hardRulesDeclineWithTheirOwnReasons() {
        assertThat(codes(CreditDecision.decide(new Applicant(18, 5_000_000, 0, 720, 0, 36), REQ, P))).containsExactly("AGE_BELOW_MINIMUM");
        assertThat(codes(CreditDecision.decide(new Applicant(64, 5_000_000, 0, 720, 0, 36), REQ, P))).containsExactly("AGE_AT_MATURITY");
        assertThat(codes(CreditDecision.decide(new Applicant(35, 0, 0, 720, 0, 36), REQ, P))).contains("NO_VERIFIED_INCOME");
        assertThat(codes(CreditDecision.decide(new Applicant(35, 5_000_000, 0, 400, 0, 36), REQ, P))).containsExactly("BUREAU_SCORE_TOO_LOW");
        assertThat(codes(CreditDecision.decide(new Applicant(35, 5_000_000, 0, 720, 2, 36), REQ, P))).containsExactly("RECENT_DELINQUENCIES");
        assertThat(codes(CreditDecision.decide(new Applicant(35, 5_000_000, 3_500_000, 720, 0, 36), REQ, P))).contains("DEBT_TO_INCOME_TOO_HIGH");
        var multiple = CreditDecision.decide(new Applicant(18, 0, 0, 400, 3, 1), REQ, P);
        assertThat(multiple.outcome()).isEqualTo(Outcome.DECLINE);
        assertThat(multiple.reasons()).hasSizeGreaterThan(3);
        assertThat(multiple.approvedAmount()).isZero();
    }

    @Test
    void scorecardCanReferOrDeclineWithoutAHardRule() {
        // thin file: no bureau score, short job, one late payment, heavier debt -> not approved
        var weak = CreditDecision.decide(new Applicant(30, 5_000_000, 1_700_000, null, 1, 3), REQ, P);
        assertThat(weak.outcome()).isNotEqualTo(Outcome.APPROVE);
        assertThat(weak.reasons().get(0).points()).isNegative();   // worst factor first: it explains the outcome
        assertThat(codes(weak)).contains("BUREAU", "AFFORDABILITY");
        // a middling file lands in REFER
        var middling = CreditDecision.decide(new Applicant(30, 5_000_000, 500_000, 610, 0, 12), REQ, P);
        assertThat(middling.outcome()).isIn(Outcome.APPROVE, Outcome.REFER);
        // unaffordable instalment blocks approval even with a strong score
        var tooBig = CreditDecision.decide(good(), new Request(10_000_000, 24, 2_100_000), P);
        assertThat(tooBig.outcome()).isNotEqualTo(Outcome.APPROVE);
    }

    @Test
    void bureauBandsAndEmploymentBands() {
        for (int score : new int[] {800, 700, 620, 540, 460}) {
            assertThat(CreditDecision.decide(new Applicant(35, 5_000_000, 500_000, score, 0, 36), REQ, P).score()).isPositive();
        }
        int hi = CreditDecision.decide(new Applicant(35, 5_000_000, 500_000, 800, 0, 36), REQ, P).score();
        int lo = CreditDecision.decide(new Applicant(35, 5_000_000, 500_000, 460, 0, 36), REQ, P).score();
        assertThat(hi).isGreaterThan(lo);
        int mid = CreditDecision.decide(new Applicant(35, 5_000_000, 500_000, 720, 0, 12), REQ, P).score();
        int shortJob = CreditDecision.decide(new Applicant(35, 5_000_000, 500_000, 720, 0, 2), REQ, P).score();
        assertThat(mid).isGreaterThan(shortJob);
    }

    // ---- sanctions
    private static SanctionsScreener screener() {
        return new SanctionsScreener(List.of(
                new SanctionsScreener.Entry("OFAC", "Ivan Petrovich Sidorov", List.of("Ivan Sidorov"), LocalDate.of(1970, 5, 1)),
                new SanctionsScreener.Entry("UN", "Maria Gonzalez", List.of(), null)), 0.93, 0.85);
    }

    @Test
    void sanctionsExactReorderedAliasAndTypo() {
        assertThat(screener().screen("Maria Gonzalez", null).verdict()).isEqualTo(Verdict.HIT);
        assertThat(screener().screen("GONZALEZ, María", null).verdict()).isEqualTo(Verdict.HIT);       // accents, punctuation, order
        assertThat(screener().screen("Ivan Sidorov", null).matches().get(0).matchedName()).isEqualTo("Ivan Sidorov");
        assertThat(screener().screen("Maria Gonzales", null).verdict()).isIn(Verdict.HIT, Verdict.POSSIBLE_MATCH);
        var clear = screener().screen("Somchai Jaidee", null);
        assertThat(clear.verdict()).isEqualTo(Verdict.CLEAR);
        assertThat(clear.matches()).isEmpty();
    }

    @Test
    void dateOfBirthAdjustsConfidence() {
        var withDob = screener().screen("Ivan Petrovich Sidorov", LocalDate.of(1970, 5, 1));
        var wrongDob = screener().screen("Ivan Petrovich Sidorov", LocalDate.of(1999, 1, 1));
        assertThat(withDob.verdict()).isEqualTo(Verdict.HIT);
        assertThat(wrongDob.matches().get(0).score()).isLessThan(withDob.matches().get(0).score());
        assertThat(wrongDob.verdict()).isIn(Verdict.POSSIBLE_MATCH, Verdict.HIT);
        // an entry with no date of birth ignores the supplied one
        assertThat(screener().screen("Maria Gonzalez", LocalDate.of(1980, 1, 1)).verdict()).isEqualTo(Verdict.HIT);
    }

    @Test
    void screenerValidationAndEdgeCases() {
        assertThatThrownBy(() -> new SanctionsScreener(List.of(), 0.8, 0.9)).isInstanceOf(IllegalArgumentException.class);
        assertThat(SanctionsScreener.jaroWinkler("", "")).isZero();
        assertThat(SanctionsScreener.jaroWinkler("abc", "")).isZero();
        assertThat(SanctionsScreener.jaroWinkler("abc", "xyz")).isZero();
        assertThat(SanctionsScreener.jaroWinkler("martha", "marhta")).isBetween(0.96, 0.97);   // textbook value 0.961
        assertThat(SanctionsScreener.normalise("  José  O'Brien-Smith ")).isEqualTo("brien jose o smith");
        assertThat(screener().screen("   ", null).verdict()).isEqualTo(Verdict.CLEAR);
    }

    // ---- fraud
    private static FraudScorer.Tx tx(long amount, int ageDays, boolean dev, boolean payee, int perHour, long out24, int hour, boolean sanc) {
        return new FraudScorer.Tx(amount, ageDays, dev, payee, perHour, out24, 100_000, hour, sanc);
    }

    @Test
    void fraudActionsByScore() {
        assertThat(FraudScorer.score(tx(10_000, 400, false, false, 0, 0, 14, false)).action()).isEqualTo(Action.ALLOW);
        var stepUp = FraudScorer.score(tx(10_000, 400, true, true, 0, 0, 14, false));
        assertThat(stepUp.action()).isEqualTo(Action.STEP_UP);
        assertThat(stepUp.signals()).extracting(FraudScorer.Signal::code).contains("NEW_DEVICE_AND_NEW_PAYEE");
        var hold = FraudScorer.score(tx(10_000, 3, true, true, 12, 0, 3, false));
        assertThat(hold.score()).isGreaterThanOrEqualTo(80);
        assertThat(hold.action()).isEqualTo(Action.BLOCK);
        assertThat(FraudScorer.score(tx(10_000, 400, false, false, 0, 0, 14, true)).action()).isEqualTo(Action.BLOCK);
        var mid = FraudScorer.score(tx(10_000, 3, true, true, 6, 0, 14, false));
        assertThat(mid.action()).isEqualTo(Action.HOLD);
        assertThat(FraudScorer.score(tx(10_000, 400, true, false, 5, 0, 14, false)).signals())
                .extracting(FraudScorer.Signal::code).contains("NEW_DEVICE", "VELOCITY_5_PER_HOUR");
        assertThat(FraudScorer.score(tx(10_000, 400, false, true, 0, 0, 14, false)).signals())
                .extracting(FraudScorer.Signal::code).containsExactly("NEW_PAYEE");
    }

    @Test
    void fraudOutflowAgainstBaselineAndCap() {
        assertThat(FraudScorer.score(tx(500_000, 400, false, false, 0, 0, 14, false)).signals())
                .extracting(FraudScorer.Signal::code).containsExactly("OUTFLOW_4X_TYPICAL");
        assertThat(FraudScorer.score(tx(2_000_000, 400, false, false, 0, 0, 14, false)).signals())
                .extracting(FraudScorer.Signal::code).containsExactly("OUTFLOW_10X_TYPICAL");
        var everything = FraudScorer.score(new FraudScorer.Tx(9_000_000, 1, true, true, 20, 5_000_000, 0, 2, true));
        assertThat(everything.score()).isEqualTo(100);
        // no history at all: baseline floors at 1 and must not divide by zero
        assertThat(FraudScorer.score(new FraudScorer.Tx(100, 400, false, false, 0, 0, 0, 14, false)).signals()).isNotEmpty();
    }
}
