package org.fabor.services.persistence;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import javax.sql.DataSource;
import org.fabor.platform.security.ConsentRegistry;
import org.fabor.platform.security.ConsentRegistry.Event;
import org.fabor.platform.tenancy.TenantId;

/** Consent history in PostgreSQL: append-only, time-ordered per party and purpose. */
public final class JdbcConsentStore implements ConsentRegistry.Store {
    private final DataSource ds;

    public JdbcConsentStore(DataSource ds) {
        this.ds = ds;
    }

    @Override
    public void append(TenantId t, Event e) {
        Jdbc.tx(ds, c -> {
            try (PreparedStatement last = Jdbc.prep(c, "SELECT MAX(at) FROM consent_event WHERE tenant = ? AND party = ? "
                    + "AND purpose = ?", t.value(), e.party(), e.purpose()); ResultSet rs = last.executeQuery()) {
                rs.next();
                var max = rs.getObject(1, java.time.OffsetDateTime.class);
                if (max != null && e.at().isBefore(max.toInstant())) {
                    throw new IllegalArgumentException("Consent events must be recorded in time order");
                }
            }
            try (PreparedStatement ps = c.prepareStatement("INSERT INTO consent_event (tenant, party, purpose, at, "
                    + "purpose_version, action, channel) VALUES (?,?,?,?,?,?,?)")) {
                ps.setString(1, t.value());
                ps.setString(2, e.party());
                ps.setString(3, e.purpose());
                ps.setObject(4, Jdbc.odt(e.at()));
                ps.setInt(5, e.purposeVersion());
                ps.setString(6, e.action().name());
                ps.setString(7, e.channel());
                return ps.executeUpdate();
            }
        });
    }

    @Override
    public List<Event> history(TenantId t, String party, String purpose) {
        return Jdbc.tx(ds, c -> {
            List<Event> out = new ArrayList<>();
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT at, purpose_version, action, channel FROM consent_event "
                    + "WHERE tenant = ? AND party = ? AND purpose = ? ORDER BY at, id", t.value(), party, purpose);
                 ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(new Event(Jdbc.instant(rs, 1), party, purpose, rs.getInt(2),
                            ConsentRegistry.Action.valueOf(rs.getString(3)), rs.getString(4)));
                }
            }
            return out;
        });
    }

    @Override
    public Set<String> purposes(TenantId t, String party) {
        return Jdbc.tx(ds, c -> {
            Set<String> out = new TreeSet<>();
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT DISTINCT purpose FROM consent_event WHERE tenant = ? AND party = ?",
                    t.value(), party); ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(rs.getString(1));
                }
            }
            return out;
        });
    }
}
