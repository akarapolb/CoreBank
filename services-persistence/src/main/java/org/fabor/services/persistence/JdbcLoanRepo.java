package org.fabor.services.persistence;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import javax.sql.DataSource;
import org.fabor.lending.Loan;
import org.fabor.lending.LoanRepo;
import org.fabor.platform.tenancy.TenantId;

/** Loans and their instalments. Saving rewrites the loan header and upserts every instalment in one transaction. */
public final class JdbcLoanRepo implements LoanRepo {
    private final DataSource ds;
    private final TenantId tenant;

    public JdbcLoanRepo(DataSource ds, TenantId tenant) {
        this.ds = ds;
        this.tenant = tenant;
    }

    @Override
    public void save(Loan l) {
        Jdbc.tx(ds, c -> {
            try (PreparedStatement ps = Jdbc.prep(c, "INSERT INTO loan (tenant, id, party, product_code, product_version, currency, "
                    + "deposit_account, disbursed_on, principal, status, rate_override, generation) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) "
                    + "ON CONFLICT (tenant, id) DO UPDATE SET status = EXCLUDED.status, rate_override = EXCLUDED.rate_override, "
                    + "generation = EXCLUDED.generation", tenant.value(), l.id(), l.party(),
                    l.productCode(), l.productVersion(), l.currency(), l.depositAccountId(), l.disbursedOn(), l.principal(),
                    l.status().name(), l.rateOverride(), l.generation())) {
                ps.executeUpdate();
            }
            try (PreparedStatement del = Jdbc.prep(c, "DELETE FROM loan_instalment WHERE tenant = ? AND loan_id = ? AND number > ?",
                    tenant.value(), l.id(), l.instalments().size())) {
                del.executeUpdate();   // a prepayment or restructuring can shorten the schedule
            }
            try (PreparedStatement ps = c.prepareStatement("INSERT INTO loan_instalment (tenant, loan_id, number, due_date, "
                    + "principal_due, interest_due, principal_paid, interest_paid, penalty_accrued, penalty_paid, billed, "
                    + "vat_due, vat_paid) "
                    + "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (tenant, loan_id, number) DO UPDATE SET "
                    + "due_date = EXCLUDED.due_date, principal_due = EXCLUDED.principal_due, interest_due = EXCLUDED.interest_due, "
                    + "principal_paid = EXCLUDED.principal_paid, interest_paid = EXCLUDED.interest_paid, "
                    + "penalty_accrued = EXCLUDED.penalty_accrued, penalty_paid = EXCLUDED.penalty_paid, billed = EXCLUDED.billed, "
                    + "vat_due = EXCLUDED.vat_due, vat_paid = EXCLUDED.vat_paid")) {
                for (Loan.Instalment i : l.instalments()) {
                    ps.setString(1, tenant.value());
                    ps.setString(2, l.id());
                    ps.setInt(3, i.number());
                    ps.setObject(4, i.dueDate());
                    ps.setLong(5, i.principalDue());
                    ps.setLong(6, i.interestDue());
                    ps.setLong(7, i.principalPaid());
                    ps.setLong(8, i.interestPaid());
                    ps.setLong(9, i.penaltyAccrued());
                    ps.setLong(10, i.penaltyPaid());
                    ps.setBoolean(11, i.billed());
                    ps.setLong(12, i.vatDue());
                    ps.setLong(13, i.vatPaid());
                    ps.addBatch();
                }
                ps.executeBatch();
            }
            return null;
        });
    }

    @Override
    public Optional<Loan> find(String id) {
        return Jdbc.tx(ds, c -> {
            Loan head;
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT party, product_code, product_version, currency, deposit_account, "
                    + "disbursed_on, principal, status, rate_override, generation FROM loan WHERE tenant = ? AND id = ?", tenant.value(), id);
                 ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.<Loan>empty();
                }
                head = new Loan(id, rs.getString(1), rs.getString(2), rs.getInt(3), rs.getString(4), rs.getString(5),
                        rs.getObject(6, LocalDate.class), rs.getLong(7), List.of(), Loan.Status.valueOf(rs.getString(8)),
                        rs.getBigDecimal(9), rs.getInt(10));
            }
            List<Loan.Instalment> list = new ArrayList<>();
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT number, due_date, principal_due, interest_due, principal_paid, "
                    + "interest_paid, penalty_accrued, penalty_paid, billed, vat_due, vat_paid FROM loan_instalment WHERE tenant = ? AND loan_id = ? "
                    + "ORDER BY number", tenant.value(), id); ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(new Loan.Instalment(rs.getInt(1), rs.getObject(2, LocalDate.class), rs.getLong(3), rs.getLong(4),
                            rs.getLong(5), rs.getLong(6), rs.getLong(7), rs.getLong(8), rs.getBoolean(9), rs.getLong(10), rs.getLong(11)));
                }
            }
            return Optional.of(head.withInstalments(List.copyOf(list), head.status()));
        });
    }

    @Override
    public List<String> activeIds() {
        return Jdbc.tx(ds, c -> {
            List<String> out = new ArrayList<>();
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT id FROM loan WHERE tenant = ? AND status NOT IN ('CLOSED', 'WRITTEN_OFF') ORDER BY id",
                    tenant.value()); ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(rs.getString(1));
                }
            }
            return out;
        });
    }

    @Override
    public List<String> idsByParty(String party) {
        return Jdbc.tx(ds, c -> {
            List<String> out = new ArrayList<>();
            try (PreparedStatement ps = Jdbc.prep(c, "SELECT id FROM loan WHERE tenant = ? AND party = ? ORDER BY disbursed_on DESC, id DESC",
                    tenant.value(), party); ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(rs.getString(1));
                }
            }
            return out;
        });
    }
}
