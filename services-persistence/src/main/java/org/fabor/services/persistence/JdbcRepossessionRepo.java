package org.fabor.services.persistence;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import javax.sql.DataSource;
import org.fabor.lending.Repossession;
import org.fabor.lending.RepossessionRepo;
import org.fabor.platform.tenancy.TenantId;

/** Repossession cases. Saving inserts the case, or moves it from OPEN to SOLD with the sale figures. */
public final class JdbcRepossessionRepo implements RepossessionRepo {
    private static final String COLUMNS = "reference, loan_id, asset_id, repossessed_on, location, status, sold_on, proceeds, "
            + "costs, owed, shortfall, surplus";

    private final DataSource ds;
    private final TenantId tenant;

    public JdbcRepossessionRepo(DataSource ds, TenantId tenant) {
        this.ds = ds;
        this.tenant = tenant;
    }

    @Override
    public void save(Repossession r) {
        Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "INSERT INTO repossession (tenant, reference, loan_id, asset_id, "
                    + "repossessed_on, location, status, sold_on, proceeds, costs, owed, shortfall, surplus) "
                    + "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (tenant, reference) DO UPDATE SET status = EXCLUDED.status, "
                    + "sold_on = EXCLUDED.sold_on, proceeds = EXCLUDED.proceeds, costs = EXCLUDED.costs, owed = EXCLUDED.owed, "
                    + "shortfall = EXCLUDED.shortfall, surplus = EXCLUDED.surplus", tenant.value(), r.reference(), r.loanId(),
                    r.assetId(), r.repossessedOn(), r.location(), r.status().name(), r.soldOn(), r.proceeds(), r.costs(), r.owed(),
                    r.shortfall(), r.surplus())) {
                ps.executeUpdate();
            }
            return null;
        });
    }

    @Override
    public Optional<Repossession> find(String reference) {
        return Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT " + COLUMNS + " FROM repossession WHERE tenant = ? AND reference = ?",
                    tenant.value(), reference); ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(read(rs)) : Optional.<Repossession>empty();
            }
        });
    }

    @Override
    public List<Repossession> forLoan(String loanId) {
        return Jdbc.tx(ds, c -> {
            List<Repossession> out = new ArrayList<>();
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT " + COLUMNS + " FROM repossession WHERE tenant = ? AND loan_id = ? "
                    + "ORDER BY repossessed_on, reference", tenant.value(), loanId); ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(read(rs));
                }
            }
            return List.copyOf(out);
        });
    }

    private static Repossession read(ResultSet rs) throws java.sql.SQLException {
        return new Repossession(rs.getString(1), rs.getString(2), rs.getString(3), rs.getObject(4, LocalDate.class),
                rs.getString(5), Repossession.Status.valueOf(rs.getString(6)), rs.getObject(7, LocalDate.class), rs.getLong(8),
                rs.getLong(9), rs.getLong(10), rs.getLong(11), rs.getLong(12));
    }
}
