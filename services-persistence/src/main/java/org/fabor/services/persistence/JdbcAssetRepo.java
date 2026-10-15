package org.fabor.services.persistence;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import javax.sql.DataSource;
import org.fabor.assets.Asset;
import org.fabor.assets.AssetRepo;
import org.fabor.assets.Policy;
import org.fabor.assets.TitleEvent;
import org.fabor.platform.tenancy.TenantId;

/** The asset register: assets, their insurance policies and title events. */
public final class JdbcAssetRepo implements AssetRepo {
    private static final String COLUMNS = "id, kind, make, model, serial_no, engine_no, registration_no, dealer_id, currency, "
            + "cost, contract_id, status, location, condition, title_holder";

    private final DataSource ds;
    private final TenantId tenant;

    public JdbcAssetRepo(DataSource ds, TenantId tenant) {
        this.ds = ds;
        this.tenant = tenant;
    }

    @Override
    public void save(Asset a) {
        Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "INSERT INTO asset (tenant, " + COLUMNS + ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) "
                    + "ON CONFLICT (tenant, id) DO UPDATE SET engine_no = EXCLUDED.engine_no, registration_no = EXCLUDED.registration_no, "
                    + "contract_id = EXCLUDED.contract_id, status = EXCLUDED.status, location = EXCLUDED.location, "
                    + "condition = EXCLUDED.condition, title_holder = EXCLUDED.title_holder", tenant.value(), a.id(),
                    a.kind().name(), a.make(), a.model(), a.serialNo(), a.engineNo(), a.registrationNo(), a.dealerId(),
                    a.currency(), a.cost(), a.contractId(), a.status().name(), a.location(), a.condition().name(),
                    a.titleHolder().name())) {
                ps.executeUpdate();
            }
            return null;
        });
    }

    @Override
    public Optional<Asset> find(String id) {
        return one("id = ?", id);
    }

    @Override
    public Optional<Asset> findBySerial(String serialNo) {
        return one("serial_no = ?", serialNo);
    }

    @Override
    public List<Asset> byStatus(Asset.Status status) {
        return many("status = ?", status.name());
    }

    @Override
    public List<Asset> byContract(String contractId) {
        return many("contract_id = ?", contractId);
    }

    @Override
    public void addPolicy(Policy p) {
        Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "INSERT INTO asset_policy (tenant, asset_id, insurer, policy_no, cover_from, "
                    + "cover_to, sum_insured, premium, financed) VALUES (?,?,?,?,?,?,?,?,?)", tenant.value(), p.assetId(),
                    p.insurer(), p.policyNo(), p.from(), p.to(), p.sumInsured(), p.premium(), p.financed())) {
                ps.executeUpdate();
            }
            return null;
        });
    }

    @Override
    public List<Policy> policies(String assetId) {
        return Jdbc.tx(ds, c -> {
            List<Policy> out = new ArrayList<>();
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT insurer, policy_no, cover_from, cover_to, sum_insured, premium, "
                    + "financed FROM asset_policy WHERE tenant = ? AND asset_id = ? ORDER BY cover_from, policy_no",
                    tenant.value(), assetId); ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(new Policy(assetId, rs.getString(1), rs.getString(2), rs.getObject(3, LocalDate.class),
                            rs.getObject(4, LocalDate.class), rs.getLong(5), rs.getLong(6), rs.getBoolean(7)));
                }
            }
            return out;
        });
    }

    @Override
    public void addTitleEvent(TitleEvent e) {
        Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "INSERT INTO asset_title_event (tenant, asset_id, on_date, from_holder, "
                    + "to_holder, reference, note) VALUES (?,?,?,?,?,?,?)", tenant.value(), e.assetId(), e.on(),
                    e.from() == null ? null : e.from().name(), e.to().name(), e.reference(), e.note())) {
                ps.executeUpdate();
            }
            return null;
        });
    }

    @Override
    public List<TitleEvent> titleEvents(String assetId) {
        return Jdbc.tx(ds, c -> {
            List<TitleEvent> out = new ArrayList<>();
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT on_date, from_holder, to_holder, reference, note FROM asset_title_event "
                    + "WHERE tenant = ? AND asset_id = ? ORDER BY seq", tenant.value(), assetId); ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String from = rs.getString(2);
                    out.add(new TitleEvent(assetId, rs.getObject(1, LocalDate.class),
                            from == null ? null : Asset.TitleHolder.valueOf(from), Asset.TitleHolder.valueOf(rs.getString(3)),
                            rs.getString(4), rs.getString(5)));
                }
            }
            return out;
        });
    }

    private Optional<Asset> one(String where, String value) {
        List<Asset> list = many(where, value);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    private List<Asset> many(String where, String value) {
        return Jdbc.tx(ds, c -> {
            List<Asset> out = new ArrayList<>();
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT " + COLUMNS + " FROM asset WHERE tenant = ? AND " + where + " ORDER BY id",
                    tenant.value(), value); ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(new Asset(rs.getString(1), Asset.Kind.valueOf(rs.getString(2)), rs.getString(3), rs.getString(4),
                            rs.getString(5), rs.getString(6), rs.getString(7), rs.getString(8), rs.getString(9), rs.getLong(10),
                            rs.getString(11), Asset.Status.valueOf(rs.getString(12)), rs.getString(13),
                            Asset.Condition.valueOf(rs.getString(14)), Asset.TitleHolder.valueOf(rs.getString(15))));
                }
            }
            return out;
        });
    }
}
