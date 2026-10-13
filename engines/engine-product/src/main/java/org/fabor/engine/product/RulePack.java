package org.fabor.engine.product;

import java.util.List;

/** Jurisdiction-specific checks, kept apart from the engine so packs can be versioned and licensed per market. */
public interface RulePack {
    String id();

    List<Issue> check(ProductDefinition product);
}
