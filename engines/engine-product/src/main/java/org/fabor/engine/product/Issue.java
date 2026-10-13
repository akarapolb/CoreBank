package org.fabor.engine.product;

public record Issue(Severity severity, String path, String message) {
    public enum Severity { ERROR, WARNING }

    public static Issue error(String path, String message) {
        return new Issue(Severity.ERROR, path, message);
    }

    public static Issue warning(String path, String message) {
        return new Issue(Severity.WARNING, path, message);
    }
}
