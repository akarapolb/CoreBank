-- Floor plan financing: dealer lines with per-unit-type terms and curtailment steps, and one drawdown per unit.
CREATE TABLE fp_line (
    tenant              text         NOT NULL,
    id                  text         NOT NULL,
    dealer_id           text         NOT NULL,
    currency            char(3)      NOT NULL,
    line_limit          bigint       NOT NULL,
    annual_rate         numeric(9,6) NOT NULL,
    payoff_window_days  integer      NOT NULL,
    settlement_account  text         NOT NULL,
    status              text         NOT NULL,
    signed_on           date         NOT NULL,
    PRIMARY KEY (tenant, id)
);
CREATE TABLE fp_unit_terms (
    tenant              text    NOT NULL,
    line_id             text    NOT NULL,
    unit_type           text    NOT NULL,
    sub_limit           bigint  NOT NULL,
    interest_free_days  integer NOT NULL,
    PRIMARY KEY (tenant, line_id, unit_type),
    FOREIGN KEY (tenant, line_id) REFERENCES fp_line (tenant, id)
);
CREATE TABLE fp_curtailment (
    tenant              text    NOT NULL,
    line_id             text    NOT NULL,
    at_day              integer NOT NULL,
    cumulative_percent  integer NOT NULL,
    PRIMARY KEY (tenant, line_id, at_day),
    FOREIGN KEY (tenant, line_id) REFERENCES fp_line (tenant, id)
);
CREATE TABLE fp_unit (
    tenant            text    NOT NULL,
    line_id           text    NOT NULL,
    unit_id           text    NOT NULL,
    unit_type         text    NOT NULL,
    drawn             bigint  NOT NULL,
    principal_paid    bigint  NOT NULL,
    drawn_on          date    NOT NULL,
    interest_through  date    NOT NULL,
    interest_accrued  bigint  NOT NULL,
    interest_paid     bigint  NOT NULL,
    subvention        bigint  NOT NULL,
    sold_on           date,
    status            text    NOT NULL,
    PRIMARY KEY (tenant, line_id, unit_id),
    FOREIGN KEY (tenant, line_id) REFERENCES fp_line (tenant, id)
);
