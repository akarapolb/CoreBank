package org.fabor.services.persistence;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import javax.sql.DataSource;
import org.fabor.lending.MasterAgreement;
import org.fabor.lending.MasterRepo;
import org.fabor.platform.tenancy.TenantId;

/** Fleet master agreements with their rate cards, and the schedules drawn under them. */
public final class JdbcMasterRepo implements MasterRepo {
    private final DataSource ds;
    private final TenantId tenant;

    public JdbcMasterRepo(DataSource ds, TenantId tenant) {
        this.ds = ds;
        this.tenant = tenant;
    }

    @Override
    public void save(MasterAgreement m) {
        Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "INSERT INTO master_agreement (tenant, id, party, currency, facility_limit, "
                    + "product_code, product_version, cross_default_dpd, status, signed_on) VALUES (?,?,?,?,?,?,?,?,?,?) "
                    + "ON CONFLICT (tenant, id) DO UPDATE SET status = EXCLUDED.status", tenant.value(), m.id(), m.party(),
                    m.currency(), m.limit(), m.productCode(), m.productVersion(), m.crossDefaultDpd(), m.status().name(),
                    m.signedOn())) {
                ps.executeUpdate();
            }
            try (PreparedStatement ps = c.prepareStatement("INSERT INTO master_rate_card (tenant, master_id, seq, vehicle_class, "
                    + "min_term, max_term, rate, valid_from, valid_to) VALUES (?,?,?,?,?,?,?,?,?) "
                    + "ON CONFLICT (tenant, master_id, seq) DO NOTHING")) {
                int seq = 0;
                for (MasterAgreement.RateCardRow r : m.rateCard()) {
                    ps.setString(1, tenant.value());
                    ps.setString(2, m.id());
                    ps.setInt(3, seq++);
                    ps.setString(4, r.vehicleClass());
                    ps.setInt(5, r.minTerm());
                    ps.setInt(6, r.maxTerm());
                    ps.setBigDecimal(7, r.rate());
                    ps.setObject(8, r.validFrom());
                    ps.setObject(9, r.validTo());
                    ps.addBatch();
                }
                ps.executeBatch();
            }
            return null;
        });
    }

    @Override
    public Optional<MasterAgreement> find(String id) {
        return Jdbc.tx(ds, c -> {
            List<MasterAgreement.RateCardRow> card = new ArrayList<>();
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT vehicle_class, min_term, max_term, rate, valid_from, valid_to "
                    + "FROM master_rate_card WHERE tenant = ? AND master_id = ? ORDER BY seq", tenant.value(), id);
                 ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    card.add(new MasterAgreement.RateCardRow(rs.getString(1), rs.getInt(2), rs.getInt(3), rs.getBigDecimal(4),
                            rs.getObject(5, LocalDate.class), rs.getObject(6, LocalDate.class)));
                }
            }
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT party, currency, facility_limit, product_code, product_version, "
                    + "cross_default_dpd, status, signed_on FROM master_agreement WHERE tenant = ? AND id = ?", tenant.value(), id);
                 ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.<MasterAgreement>empty();
                }
                return Optional.of(new MasterAgreement(id, rs.getString(1), rs.getString(2), rs.getLong(3), rs.getString(4),
                        rs.getInt(5), rs.getInt(6), List.copyOf(card), MasterAgreement.Status.valueOf(rs.getString(7)),
                        rs.getObject(8, LocalDate.class)));
            }
        });
    }

    @Override
    public void addSchedule(MasterAgreement.Schedule s) {
        Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "INSERT INTO master_schedule (tenant, master_id, loan_id, vehicle_class, "
                    + "locked_rate, term, called_off_on, asset_ids) VALUES (?,?,?,?,?,?,?,?)", tenant.value(), s.masterId(),
                    s.loanId(), s.vehicleClass(), s.lockedRate(), s.term(), s.calledOffOn(), String.join("\n", s.assetIds()))) {
                ps.executeUpdate();
            }
            return null;
        });
    }

    @Override
    public List<MasterAgreement.Schedule> schedules(String masterId) {
        return Jdbc.tx(ds, c -> {
            List<MasterAgreement.Schedule> out = new ArrayList<>();
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT loan_id, vehicle_class, locked_rate, term, called_off_on, asset_ids "
                    + "FROM master_schedule WHERE tenant = ? AND master_id = ? ORDER BY seq", tenant.value(), masterId);
                 ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String ids = rs.getString(6);
                    out.add(new MasterAgreement.Schedule(masterId, rs.getString(1), rs.getString(2), rs.getBigDecimal(3),
                            rs.getInt(4), rs.getObject(5, LocalDate.class), ids.isEmpty() ? List.of() : List.of(ids.split("\n"))));
                }
            }
            return out;
        });
    }
}
