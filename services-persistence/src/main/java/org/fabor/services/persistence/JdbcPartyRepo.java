package org.fabor.services.persistence;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.Optional;
import javax.sql.DataSource;
import org.fabor.onboarding.Party;
import org.fabor.onboarding.Ports;
import org.fabor.platform.tenancy.TenantId;

public final class JdbcPartyRepo implements Ports.PartyRepo {
    private final DataSource ds;
    private final TenantId tenant;

    public JdbcPartyRepo(DataSource ds, TenantId tenant) {
        this.ds = ds;
        this.tenant = tenant;
    }

    @Override
    public void save(Party p) {
        Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = c.prepareStatement("INSERT INTO party (tenant, id, name_token, national_id_token, "
                    + "phone_token, date_of_birth, status, deposit_account) VALUES (?,?,?,?,?,?,?,?) "
                    + "ON CONFLICT (tenant, id) DO UPDATE SET status = EXCLUDED.status, deposit_account = EXCLUDED.deposit_account")) {
                ps.setString(1, tenant.value());
                ps.setString(2, p.id());
                ps.setString(3, p.nameToken());
                ps.setString(4, p.nationalIdToken());
                ps.setString(5, p.phoneToken());
                ps.setObject(6, p.dateOfBirth());
                ps.setString(7, p.status().name());
                ps.setString(8, p.depositAccountId());
                return ps.executeUpdate();
            }
        });
    }

    @Override
    public Optional<Party> find(String id) {
        return Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT name_token, national_id_token, phone_token, date_of_birth, status, "
                    + "deposit_account FROM party WHERE tenant = ? AND id = ?", tenant.value(), id); ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(new Party(id, rs.getString(1), rs.getString(2), rs.getString(3),
                        rs.getObject(4, LocalDate.class), Party.Status.valueOf(rs.getString(5)), rs.getString(6))) : Optional.empty();
            }
        });
    }
}
