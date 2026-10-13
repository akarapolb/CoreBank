package org.fabor.accounting;

public record GlAccount(String code, String name, Type type) {
    public enum Type { ASSET, LIABILITY, INCOME, EXPENSE }
}
