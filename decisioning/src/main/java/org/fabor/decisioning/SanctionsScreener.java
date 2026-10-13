package org.fabor.decisioning;

import java.text.Normalizer;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * Name screening against a watchlist: normalised, token-order-insensitive Jaro-Winkler similarity. A hit blocks
 * the action for review, a possible match goes to an analyst, a clear result passes. A matching date of birth
 * raises confidence, a conflicting one lowers it. Lists are data supplied by the compliance team.
 */
public final class SanctionsScreener {
    public enum Verdict { CLEAR, POSSIBLE_MATCH, HIT }

    public record Entry(String listId, String name, List<String> aliases, LocalDate dateOfBirth) { }

    public record Match(String listId, String matchedName, double score) { }

    public record Result(Verdict verdict, List<Match> matches) { }

    private final List<Entry> watchlist;
    private final double hitThreshold;
    private final double reviewThreshold;

    public SanctionsScreener(List<Entry> watchlist, double hitThreshold, double reviewThreshold) {
        if (reviewThreshold > hitThreshold) {
            throw new IllegalArgumentException("reviewThreshold must not exceed hitThreshold");
        }
        this.watchlist = List.copyOf(watchlist);
        this.hitThreshold = hitThreshold;
        this.reviewThreshold = reviewThreshold;
    }

    public Result screen(String name, LocalDate dateOfBirth) {
        List<Match> matches = new ArrayList<>();
        for (Entry e : watchlist) {
            double best = score(name, e.name());
            String bestName = e.name();
            for (String alias : e.aliases()) {
                double s = score(name, alias);
                if (s > best) {
                    best = s;
                    bestName = alias;
                }
            }
            if (dateOfBirth != null && e.dateOfBirth() != null) {
                best = e.dateOfBirth().equals(dateOfBirth) ? Math.min(1.0, best + 0.05) : best - 0.10;
            }
            if (best >= reviewThreshold) {
                matches.add(new Match(e.listId(), bestName, best));
            }
        }
        matches.sort(Comparator.comparingDouble(Match::score).reversed());
        Verdict v = matches.isEmpty() ? Verdict.CLEAR
                : matches.get(0).score() >= hitThreshold ? Verdict.HIT : Verdict.POSSIBLE_MATCH;
        return new Result(v, List.copyOf(matches));
    }

    static double score(String a, String b) {
        return jaroWinkler(normalise(a), normalise(b));
    }

    /** Lower-case, strip accents and punctuation, sort tokens so "Smith John" equals "John Smith". */
    static String normalise(String s) {
        String folded = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N} ]", " ");
        return Arrays.stream(folded.trim().split("\\s+")).filter(t -> !t.isEmpty()).sorted().collect(Collectors.joining(" "));
    }

    static double jaroWinkler(String s1, String s2) {
        if (s1.equals(s2)) {
            return s1.isEmpty() ? 0.0 : 1.0;
        }
        int len1 = s1.length();
        int len2 = s2.length();
        if (len1 == 0 || len2 == 0) {
            return 0.0;
        }
        int window = Math.max(0, Math.max(len1, len2) / 2 - 1);
        boolean[] m1 = new boolean[len1];
        boolean[] m2 = new boolean[len2];
        int matches = 0;
        for (int i = 0; i < len1; i++) {
            for (int j = Math.max(0, i - window); j < Math.min(len2, i + window + 1); j++) {
                if (!m2[j] && s1.charAt(i) == s2.charAt(j)) {
                    m1[i] = true;
                    m2[j] = true;
                    matches++;
                    break;
                }
            }
        }
        if (matches == 0) {
            return 0.0;
        }
        int transpositions = 0;
        int k = 0;
        for (int i = 0; i < len1; i++) {
            if (m1[i]) {
                while (!m2[k]) {
                    k++;
                }
                if (s1.charAt(i) != s2.charAt(k)) {
                    transpositions++;
                }
                k++;
            }
        }
        double jaro = ((double) matches / len1 + (double) matches / len2 + (matches - transpositions / 2.0) / matches) / 3.0;
        int prefix = 0;
        for (int i = 0; i < Math.min(4, Math.min(len1, len2)) && s1.charAt(i) == s2.charAt(i); i++) {
            prefix++;
        }
        return jaro + prefix * 0.1 * (1 - jaro);
    }
}
