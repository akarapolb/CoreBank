package org.fabor.services.persistence;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import javax.sql.DataSource;
import org.fabor.lending.Lease;
import org.fabor.lending.LeaseRepo;
import org.fabor.platform.tenancy.TenantId;

/** Leases and their periods. Saving rewrites the header and upserts every period in one transaction. */
public final class JdbcLeaseRepo implements LeaseRepo {
    private final DataSource ds;
    private final TenantId tenant;

    public JdbcLeaseRepo(DataSource ds, TenantId tenant) {
        this.ds = ds;
        this.tenant = tenant;
    }

    @Override
    public void save(Lease l) {
        Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "INSERT INTO lease (tenant, id, party, kind, currency, deposit_account, "
                    + "start_date, asset_cost, residual, status) VALUES (?,?,?,?,?,?,?,?,?,?) "
                    + "ON CONFLICT (tenant, id) DO UPDATE SET status = EXCLUDED.status", tenant.value(), l.id(), l.party(),
                    l.kind().name(), l.currency(), l.depositAccountId(), l.startDate(), l.assetCost(), l.residual(),
                    l.status().name())) {
                ps.executeUpdate();
            }
            try (PreparedStatement ps = c.prepareStatement("INSERT INTO lease_period (tenant, lease_id, number, due_date, "
                    + "payment, income, rent_recognised, depreciation, accrued, paid) VALUES (?,?,?,?,?,?,?,?,?,?) "
                    + "ON CONFLICT (tenant, lease_id, number) DO UPDATE SET accrued = EXCLUDED.accrued, paid = EXCLUDED.paid")) {
                for (Lease.Period p : l.periods()) {
                    ps.setString(1, tenant.value());
                    ps.setString(2, l.id());
                    ps.setInt(3, p.number());
                    ps.setObject(4, p.dueDate());
                    ps.setLong(5, p.payment());
                    ps.setLong(6, p.income());
                    ps.setLong(7, p.rentRecognised());
                    ps.setLong(8, p.depreciation());
                    ps.setBoolean(9, p.accrued());
                    ps.setLong(10, p.paid());
                    ps.addBatch();
                }
                ps.executeBatch();
            }
            return null;
        });
    }

    @Override
    public Optional<Lease> find(String id) {
        return Jdbc.tx(ds, c -> {
            Lease head;
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT party, kind, currency, deposit_account, start_date, asset_cost, "
                    + "residual, status FROM lease WHERE tenant = ? AND id = ?", tenant.value(), id);
                 ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.<Lease>empty();
                }
                head = new Lease(id, rs.getString(1), Lease.Kind.valueOf(rs.getString(2)), rs.getString(3), rs.getString(4),
                        rs.getObject(5, LocalDate.class), rs.getLong(6), rs.getLong(7), List.of(),
                        Lease.Status.valueOf(rs.getString(8)));
            }
            List<Lease.Period> list = new ArrayList<>();
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT number, due_date, payment, income, rent_recognised, depreciation, "
                    + "accrued, paid FROM lease_period WHERE tenant = ? AND lease_id = ? ORDER BY number", tenant.value(), id);
                 ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(new Lease.Period(rs.getInt(1), rs.getObject(2, LocalDate.class), rs.getLong(3), rs.getLong(4),
                            rs.getLong(5), rs.getLong(6), rs.getBoolean(7), rs.getLong(8)));
                }
            }
            return Optional.of(head.withPeriods(List.copyOf(list), head.status()));
        });
    }

    @Override
    public List<String> idsByParty(String party) {
        return Jdbc.tx(ds, c -> {
            List<String> out = new ArrayList<>();
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT id FROM lease WHERE tenant = ? AND party = ? "
                    + "ORDER BY start_date DESC, id DESC", tenant.value(), party); ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(rs.getString(1));
                }
            }
            return out;
        });
    }
}
