package org.fabor.agent;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class ToolRegistry {
    private final Map<String, Tool> tools = new LinkedHashMap<>();

    public ToolRegistry register(Tool tool) {
        if (!tool.readOnly()) {
            throw new IllegalArgumentException("Write tools are not enabled in Phase 0: " + tool.name());
        }
        if (tools.putIfAbsent(tool.name(), tool) != null) {
            throw new IllegalArgumentException("Duplicate tool " + tool.name());
        }
        return this;
    }

    public Optional<Tool> find(String name) {
        return Optional.ofNullable(tools.get(name));
    }

    public List<Tool> all() {
        return List.copyOf(tools.values());
    }
}
