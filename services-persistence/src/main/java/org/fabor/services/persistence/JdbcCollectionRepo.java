package org.fabor.services.persistence;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import javax.sql.DataSource;
import org.fabor.lending.CollectionEvent;
import org.fabor.lending.CollectionRepo;
import org.fabor.platform.tenancy.TenantId;

/** Collection events, append only: a repeated reference is ignored, so a retry cannot double-record. */
public final class JdbcCollectionRepo implements CollectionRepo {
    private static final String COLUMNS = "loan_id, reference, event_date, kind, channel, note, promised_amount, pay_by, "
            + "overdue_at_promise";

    private final DataSource ds;
    private final TenantId tenant;

    public JdbcCollectionRepo(DataSource ds, TenantId tenant) {
        this.ds = ds;
        this.tenant = tenant;
    }

    @Override
    public void add(CollectionEvent e) {
        Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "INSERT INTO collection_event (tenant, loan_id, reference, event_date, kind, "
                    + "channel, note, promised_amount, pay_by, overdue_at_promise) VALUES (?,?,?,?,?,?,?,?,?,?) "
                    + "ON CONFLICT (tenant, loan_id, reference) DO NOTHING", tenant.value(), e.loanId(), e.reference(), e.date(),
                    e.kind().name(), e.channel().name(), e.note(), e.promisedAmount(), e.payBy(), e.overdueAtPromise())) {
                ps.executeUpdate();
            }
            return null;
        });
    }

    @Override
    public Optional<CollectionEvent> find(String loanId, String reference) {
        return Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT " + COLUMNS + " FROM collection_event WHERE tenant = ? AND loan_id = ? "
                    + "AND reference = ?", tenant.value(), loanId, reference); ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(read(rs)) : Optional.<CollectionEvent>empty();
            }
        });
    }

    @Override
    public List<CollectionEvent> events(String loanId) {
        return Jdbc.tx(ds, c -> {
            List<CollectionEvent> out = new ArrayList<>();
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT " + COLUMNS + " FROM collection_event WHERE tenant = ? AND loan_id = ? "
                    + "ORDER BY seq", tenant.value(), loanId); ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(read(rs));
                }
            }
            return List.copyOf(out);
        });
    }

    private static CollectionEvent read(ResultSet rs) throws java.sql.SQLException {
        return new CollectionEvent(rs.getString(1), rs.getString(2), rs.getObject(3, LocalDate.class),
                CollectionEvent.Kind.valueOf(rs.getString(4)), CollectionEvent.Channel.valueOf(rs.getString(5)), rs.getString(6),
                rs.getLong(7), rs.getObject(8, LocalDate.class), rs.getLong(9));
    }
}
