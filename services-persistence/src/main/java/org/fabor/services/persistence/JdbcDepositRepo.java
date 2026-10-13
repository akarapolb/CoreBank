package org.fabor.services.persistence;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Optional;
import javax.sql.DataSource;
import org.fabor.deposit.DepositAccount;
import org.fabor.deposit.DepositRepo;
import org.fabor.platform.tenancy.TenantId;

public final class JdbcDepositRepo implements DepositRepo {
    private final DataSource ds;
    private final TenantId tenant;

    public JdbcDepositRepo(DataSource ds, TenantId tenant) {
        this.ds = ds;
        this.tenant = tenant;
    }

    @Override
    public void save(DepositAccount a) {
        Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "INSERT INTO deposit_account (tenant, id, party, product_code, "
                    + "product_version, currency) VALUES (?,?,?,?,?,?) ON CONFLICT (tenant, id) DO NOTHING",
                    tenant.value(), a.id(), a.party(), a.productCode(), a.productVersion(), a.currency())) {
                return ps.executeUpdate();
            }
        });
    }

    @Override
    public Optional<DepositAccount> find(String id) {
        return Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT party, product_code, product_version, currency FROM deposit_account "
                    + "WHERE tenant = ? AND id = ?", tenant.value(), id); ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(new DepositAccount(id, rs.getString(1), rs.getString(2), rs.getInt(3), rs.getString(4)))
                        : Optional.empty();
            }
        });
    }

    @Override
    public YearToDate yearToDate(String accountId, int year) {
        return Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT gross, withheld FROM deposit_ytd WHERE tenant = ? AND account = ? "
                    + "AND year = ?", tenant.value(), accountId, year); ResultSet rs = ps.executeQuery()) {
                return rs.next() ? new YearToDate(rs.getLong(1), rs.getLong(2)) : new YearToDate(0, 0);
            }
        });
    }

    @Override
    public void addYearToDate(String accountId, int year, long gross, long withheld) {
        Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "INSERT INTO deposit_ytd (tenant, account, year, gross, withheld) "
                    + "VALUES (?,?,?,?,?) ON CONFLICT (tenant, account, year) DO UPDATE SET "
                    + "gross = deposit_ytd.gross + EXCLUDED.gross, withheld = deposit_ytd.withheld + EXCLUDED.withheld",
                    tenant.value(), accountId, year, gross, withheld)) {
                return ps.executeUpdate();
            }
        });
    }
}
