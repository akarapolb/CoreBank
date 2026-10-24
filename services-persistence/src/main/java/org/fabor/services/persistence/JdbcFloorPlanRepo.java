package org.fabor.services.persistence;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import javax.sql.DataSource;
import org.fabor.lending.FloorPlanLine;
import org.fabor.lending.FloorPlanRepo;
import org.fabor.lending.FloorPlanUnit;
import org.fabor.platform.tenancy.TenantId;

/** Floor plan lines (with their terms and curtailment steps) and unit drawdowns. */
public final class JdbcFloorPlanRepo implements FloorPlanRepo {
    private static final String UNIT_COLUMNS = "line_id, unit_id, unit_type, drawn, principal_paid, drawn_on, interest_through, "
            + "interest_accrued, interest_paid, subvention, sold_on, status";

    private final DataSource ds;
    private final TenantId tenant;

    public JdbcFloorPlanRepo(DataSource ds, TenantId tenant) {
        this.ds = ds;
        this.tenant = tenant;
    }

    @Override
    public void saveLine(FloorPlanLine l) {
        Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "INSERT INTO fp_line (tenant, id, dealer_id, currency, line_limit, annual_rate, "
                    + "payoff_window_days, settlement_account, status, signed_on) VALUES (?,?,?,?,?,?,?,?,?,?) "
                    + "ON CONFLICT (tenant, id) DO UPDATE SET status = EXCLUDED.status", tenant.value(), l.id(), l.dealerId(),
                    l.currency(), l.limit(), l.annualRate(), l.payoffWindowDays(), l.settlementAccountId(), l.status().name(),
                    l.signedOn())) {
                ps.executeUpdate();
            }
            for (Map.Entry<FloorPlanLine.UnitType, FloorPlanLine.UnitTerms> t : l.terms().entrySet()) {
                try (PreparedStatement ps = Jdbc.prep(c, "INSERT INTO fp_unit_terms (tenant, line_id, unit_type, sub_limit, "
                        + "interest_free_days) VALUES (?,?,?,?,?) ON CONFLICT (tenant, line_id, unit_type) DO NOTHING",
                        tenant.value(), l.id(), t.getKey().name(), t.getValue().subLimit(), t.getValue().interestFreeDays())) {
                    ps.executeUpdate();
                }
            }
            for (FloorPlanLine.Step s : l.curtailments()) {
                try (PreparedStatement ps = Jdbc.prep(c, "INSERT INTO fp_curtailment (tenant, line_id, at_day, cumulative_percent) "
                        + "VALUES (?,?,?,?) ON CONFLICT (tenant, line_id, at_day) DO NOTHING", tenant.value(), l.id(), s.atDay(),
                        s.cumulativePercent())) {
                    ps.executeUpdate();
                }
            }
            return null;
        });
    }

    @Override
    public Optional<FloorPlanLine> findLine(String id) {
        return Jdbc.tx(ds, c -> {
            Map<FloorPlanLine.UnitType, FloorPlanLine.UnitTerms> terms = new EnumMap<>(FloorPlanLine.UnitType.class);
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT unit_type, sub_limit, interest_free_days FROM fp_unit_terms "
                    + "WHERE tenant = ? AND line_id = ?", tenant.value(), id); ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    terms.put(FloorPlanLine.UnitType.valueOf(rs.getString(1)), new FloorPlanLine.UnitTerms(rs.getLong(2), rs.getInt(3)));
                }
            }
            List<FloorPlanLine.Step> steps = new ArrayList<>();
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT at_day, cumulative_percent FROM fp_curtailment WHERE tenant = ? "
                    + "AND line_id = ? ORDER BY at_day", tenant.value(), id); ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    steps.add(new FloorPlanLine.Step(rs.getInt(1), rs.getInt(2)));
                }
            }
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT dealer_id, currency, line_limit, annual_rate, payoff_window_days, "
                    + "settlement_account, status, signed_on FROM fp_line WHERE tenant = ? AND id = ?", tenant.value(), id);
                 ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.<FloorPlanLine>empty();
                }
                return Optional.of(new FloorPlanLine(id, rs.getString(1), rs.getString(2), rs.getLong(3), rs.getBigDecimal(4),
                        rs.getInt(5), rs.getString(6), terms, steps, FloorPlanLine.Status.valueOf(rs.getString(7)),
                        rs.getObject(8, LocalDate.class)));
            }
        });
    }

    @Override
    public void saveUnit(FloorPlanUnit u) {
        Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "INSERT INTO fp_unit (tenant, " + UNIT_COLUMNS + ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) "
                    + "ON CONFLICT (tenant, line_id, unit_id) DO UPDATE SET principal_paid = EXCLUDED.principal_paid, "
                    + "interest_through = EXCLUDED.interest_through, interest_accrued = EXCLUDED.interest_accrued, "
                    + "interest_paid = EXCLUDED.interest_paid, subvention = EXCLUDED.subvention, sold_on = EXCLUDED.sold_on, "
                    + "status = EXCLUDED.status", tenant.value(), u.lineId(), u.unitId(), u.type().name(), u.drawn(),
                    u.principalPaid(), u.drawnOn(), u.interestThrough(), u.interestAccrued(), u.interestPaid(), u.subvention(),
                    u.soldOn(), u.status().name())) {
                ps.executeUpdate();
            }
            return null;
        });
    }

    @Override
    public Optional<FloorPlanUnit> findUnit(String lineId, String unitId) {
        List<FloorPlanUnit> list = query("AND unit_id = ?", lineId, unitId);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    @Override
    public List<String> lineIds() {
        return Jdbc.tx(ds, c -> {
            List<String> out = new ArrayList<>();
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT id FROM fp_line WHERE tenant = ? ORDER BY id", tenant.value());
                 ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(rs.getString(1));
                }
            }
            return out;
        });
    }

    @Override
    public List<FloorPlanUnit> units(String lineId) {
        return query("", lineId);
    }

    private List<FloorPlanUnit> query(String extra, Object... args) {
        return Jdbc.tx(ds, c -> {
            Object[] all = new Object[args.length + 1];
            all[0] = tenant.value();
            System.arraycopy(args, 0, all, 1, args.length);
            List<FloorPlanUnit> out = new ArrayList<>();
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT " + UNIT_COLUMNS + " FROM fp_unit WHERE tenant = ? AND line_id = ? "
                    + extra + " ORDER BY drawn_on, unit_id", all); ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(new FloorPlanUnit(rs.getString(1), rs.getString(2), FloorPlanLine.UnitType.valueOf(rs.getString(3)),
                            rs.getLong(4), rs.getLong(5), rs.getObject(6, LocalDate.class), rs.getObject(7, LocalDate.class),
                            rs.getLong(8), rs.getLong(9), rs.getLong(10), rs.getObject(11, LocalDate.class),
                            FloorPlanUnit.Status.valueOf(rs.getString(12))));
                }
            }
            return out;
        });
    }
}
