package org.fabor.services.persistence;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import javax.sql.DataSource;
import org.fabor.assets.Dealer;
import org.fabor.assets.DealerRepo;
import org.fabor.platform.tenancy.TenantId;

/** Dealers of the dealer channel. */
public final class JdbcDealerRepo implements DealerRepo {
    private final DataSource ds;
    private final TenantId tenant;

    public JdbcDealerRepo(DataSource ds, TenantId tenant) {
        this.ds = ds;
        this.tenant = tenant;
    }

    @Override
    public void save(Dealer d) {
        Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "INSERT INTO dealer (tenant, id, name, tax_id, status, commission_rate) "
                    + "VALUES (?,?,?,?,?,?) ON CONFLICT (tenant, id) DO UPDATE SET status = EXCLUDED.status",
                    tenant.value(), d.id(), d.name(), d.taxId(), d.status().name(), d.commissionRate())) {
                ps.executeUpdate();
            }
            return null;
        });
    }

    @Override
    public Optional<Dealer> find(String id) {
        List<Dealer> list = query("AND id = ?", id);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    @Override
    public List<Dealer> all() {
        return query("");
    }

    private List<Dealer> query(String extra, Object... args) {
        return Jdbc.tx(ds, c -> {
            Object[] all = new Object[args.length + 1];
            all[0] = tenant.value();
            System.arraycopy(args, 0, all, 1, args.length);
            List<Dealer> out = new ArrayList<>();
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT id, name, tax_id, status, commission_rate FROM dealer WHERE tenant = ? "
                    + extra + " ORDER BY id", all); ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(new Dealer(rs.getString(1), rs.getString(2), rs.getString(3), Dealer.Status.valueOf(rs.getString(4)),
                            rs.getBigDecimal(5)));
                }
            }
            return out;
        });
    }
}
