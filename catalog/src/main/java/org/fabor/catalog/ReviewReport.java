package org.fabor.catalog;

import java.util.List;
import org.fabor.engine.product.Issue;
import org.fabor.simulator.ScenarioResult;

/** Everything a reviewer needs: rule findings, the standard scenario results and their hash (the golden). */
public record ReviewReport(List<Issue> issues, List<ScenarioResult> scenarios, String goldenHash, String yamlHash) {
    public boolean ok() {
        return issues.stream().noneMatch(i -> i.severity() == Issue.Severity.ERROR);
    }
}
