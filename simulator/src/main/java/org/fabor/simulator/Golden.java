package org.fabor.simulator;

import com.fasterxml.jackson.core.PrettyPrinter;
import com.fasterxml.jackson.core.util.DefaultIndenter;
import com.fasterxml.jackson.core.util.DefaultPrettyPrinter;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * Golden files pin a product version's behaviour to the satang. A product change that alters any figure
 * fails verification until a reviewer regenerates the file, which shows up in the diff and in approval.
 */
public final class Golden {
    private static final ObjectMapper JSON = new ObjectMapper();
    // fixed line feeds: the default printer uses the platform separator, so golden files would differ on Windows
    private static final PrettyPrinter PRINTER = new DefaultPrettyPrinter()
            .withObjectIndenter(new DefaultIndenter("  ", "\n"));

    private Golden() { }

    public static String render(List<ScenarioResult> results) {
        try {
            return JSON.writer(PRINTER).writeValueAsString(results) + "\n";
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    public static void record(Path file, List<ScenarioResult> results) throws IOException {
        Files.createDirectories(file.getParent());
        Files.writeString(file, render(results), StandardCharsets.UTF_8);
    }

    /** @return empty if the results match the golden file; otherwise a description of the difference */
    public static java.util.Optional<String> verify(Path file, List<ScenarioResult> results) throws IOException {
        String expected = Files.readString(file, StandardCharsets.UTF_8);
        String actual = render(results);
        if (expected.equals(actual)) {
            return java.util.Optional.empty();
        }
        String[] e = expected.split("\n");
        String[] a = actual.split("\n");
        for (int i = 0; i < Math.max(e.length, a.length); i++) {
            String el = i < e.length ? e[i] : "<end>";
            String al = i < a.length ? a[i] : "<end>";
            if (!el.equals(al)) {
                return java.util.Optional.of("line " + (i + 1) + ": golden has [" + el.trim() + "] but simulation gives ["
                        + al.trim() + "]");
            }
        }
        return java.util.Optional.of("results differ");
    }
}
