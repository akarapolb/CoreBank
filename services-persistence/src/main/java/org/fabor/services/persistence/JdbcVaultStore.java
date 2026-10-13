package org.fabor.services.persistence;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import javax.sql.DataSource;
import org.fabor.platform.security.PiiVault;
import org.fabor.platform.security.PiiVault.Entry;
import org.fabor.platform.tenancy.TenantId;

/** Encrypted PII in PostgreSQL. Only ciphertext, nonce, key id and the keyed blind index are stored. */
public final class JdbcVaultStore implements PiiVault.Store {
    private final DataSource ds;

    public JdbcVaultStore(DataSource ds) {
        this.ds = ds;
    }

    @Override
    public Optional<String> putIfAbsent(TenantId t, String token, Entry e) {
        return Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = c.prepareStatement("INSERT INTO pii_vault (tenant, token, key_id, nonce, ciphertext, "
                    + "blind_index) VALUES (?,?,?,?,?,?) ON CONFLICT (tenant, blind_index) DO NOTHING")) {
                ps.setString(1, t.value());
                ps.setString(2, token);
                ps.setString(3, e.keyId());
                ps.setBytes(4, e.nonce());
                ps.setBytes(5, e.ciphertext());
                ps.setString(6, e.index());
                if (ps.executeUpdate() == 1) {
                    return Optional.<String>empty();
                }
            }
            return tokenByIndex(t, e.index());
        });
    }

    @Override
    public Optional<Entry> get(TenantId t, String token) {
        return Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT key_id, nonce, ciphertext, blind_index FROM pii_vault "
                    + "WHERE tenant = ? AND token = ?", t.value(), token); ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(new Entry(rs.getString(1), rs.getBytes(2), rs.getBytes(3), rs.getString(4)))
                        : Optional.empty();
            }
        });
    }

    @Override
    public Optional<String> tokenByIndex(TenantId t, String index) {
        return Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT token FROM pii_vault WHERE tenant = ? AND blind_index = ?",
                    t.value(), index); ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(rs.getString(1)) : Optional.empty();
            }
        });
    }

    @Override
    public void replace(TenantId t, String token, Entry e) {
        Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = c.prepareStatement("UPDATE pii_vault SET key_id = ?, nonce = ?, ciphertext = ? "
                    + "WHERE tenant = ? AND token = ?")) {
                ps.setString(1, e.keyId());
                ps.setBytes(2, e.nonce());
                ps.setBytes(3, e.ciphertext());
                ps.setString(4, t.value());
                ps.setString(5, token);
                return ps.executeUpdate();
            }
        });
    }

    @Override
    public Map<String, Entry> all(TenantId t) {
        return Jdbc.tx(ds, c -> {
            Map<String, Entry> out = new HashMap<>();
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT token, key_id, nonce, ciphertext, blind_index FROM pii_vault "
                    + "WHERE tenant = ?", t.value()); ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.put(rs.getString(1), new Entry(rs.getString(2), rs.getBytes(3), rs.getBytes(4), rs.getString(5)));
                }
            }
            return out;
        });
    }
}
