package org.fabor.services.persistence;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import javax.sql.DataSource;
import org.fabor.catalog.CatalogStore;
import org.fabor.catalog.Draft;
import org.fabor.catalog.PublishedVersion;

/** Catalog in PostgreSQL. Published versions are insert-only (plus the retired flag); the (product, version) key blocks duplicates. */
public final class JdbcCatalogStore implements CatalogStore {
    private final DataSource ds;

    public JdbcCatalogStore(DataSource ds) {
        this.ds = ds;
    }

    @Override
    public void saveDraft(Draft d) {
        Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "INSERT INTO catalog_draft (id, product, version, author, yaml, yaml_hash, "
                    + "status, reviewed_hash, approvals) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT (id) DO UPDATE SET yaml = EXCLUDED.yaml, "
                    + "yaml_hash = EXCLUDED.yaml_hash, status = EXCLUDED.status, reviewed_hash = EXCLUDED.reviewed_hash, "
                    + "approvals = EXCLUDED.approvals", d.id(), d.product(), d.version(), d.author(), d.yaml(), d.yamlHash(),
                    d.status().name(), d.reviewedHash(), encode(d.approvals()))) {
                return ps.executeUpdate();
            }
        });
    }

    @Override
    public Optional<Draft> draft(String id) {
        return Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT product, version, author, yaml, yaml_hash, status, reviewed_hash, "
                    + "approvals FROM catalog_draft WHERE id = ?", id); ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(new Draft(id, rs.getString(1), rs.getInt(2), rs.getString(3), rs.getString(4),
                        rs.getString(5), Draft.Status.valueOf(rs.getString(6)), rs.getString(7), decode(rs.getString(8))))
                        : Optional.empty();
            }
        });
    }

    @Override
    public java.util.List<Draft> openDrafts() {
        return Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT id, product, version, author, yaml, yaml_hash, status, reviewed_hash, "
                    + "approvals FROM catalog_draft WHERE status <> 'PUBLISHED' ORDER BY id"); ResultSet rs = ps.executeQuery()) {
                java.util.List<Draft> out = new java.util.ArrayList<>();
                while (rs.next()) {
                    out.add(new Draft(rs.getString(1), rs.getString(2), rs.getInt(3), rs.getString(4), rs.getString(5), rs.getString(6),
                            Draft.Status.valueOf(rs.getString(7)), rs.getString(8), decode(rs.getString(9))));
                }
                return out;
            }
        });
    }

    @Override
    public void publish(PublishedVersion v) {
        try {
            Jdbc.tx(ds, c -> {
                try (PreparedStatement ps = Jdbc.prep(c, "INSERT INTO catalog_version (product, version, yaml, yaml_hash, golden_hash, "
                        + "author, approvals, published_by, published_at, retired) VALUES (?,?,?,?,?,?,?,?,?,?)", v.product(),
                        v.version(), v.yaml(), v.yamlHash(), v.goldenHash(), v.author(), encode(v.approvals()), v.publishedBy(),
                        Jdbc.odt(v.publishedAt()), v.retired())) {
                    return ps.executeUpdate();
                }
            });
        } catch (IllegalStateException e) {
            if (String.valueOf(e.getMessage()).contains("catalog_version_pkey")) {
                throw new IllegalStateException("Version already published: " + v.product() + " v" + v.version(), e);
            }
            throw e;
        }
    }

    @Override
    public Optional<PublishedVersion> version(String product, int version) {
        return versions(product).stream().filter(v -> v.version() == version).findFirst();
    }

    @Override
    public List<PublishedVersion> versions(String product) {
        return Jdbc.tx(ds, c -> {
            List<PublishedVersion> out = new ArrayList<>();
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT version, yaml, yaml_hash, golden_hash, author, approvals, published_by, "
                    + "published_at, retired FROM catalog_version WHERE product = ? ORDER BY version", product);
                 ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(new PublishedVersion(product, rs.getInt(1), rs.getString(2), rs.getString(3), rs.getString(4),
                            rs.getString(5), decode(rs.getString(6)), rs.getString(7), Jdbc.instant(rs, 8), rs.getBoolean(9)));
                }
            }
            return out;
        });
    }

    @Override
    public void markRetired(String product, int version) {
        Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "UPDATE catalog_version SET retired = true WHERE product = ? AND version = ?",
                    product, version)) {
                return ps.executeUpdate();
            }
        });
    }

    static String encode(Map<String, String> approvals) {
        StringBuilder sb = new StringBuilder();
        approvals.forEach((role, actor) -> sb.append(role).append('=').append(actor).append('\n'));
        return sb.toString();
    }

    static Map<String, String> decode(String s) {
        Map<String, String> out = new LinkedHashMap<>();
        for (String line : s.split("\n")) {
            int i = line.indexOf('=');
            if (i > 0) {
                out.put(line.substring(0, i), line.substring(i + 1));
            }
        }
        return Map.copyOf(out);
    }
}
