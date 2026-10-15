-- Lessor-side leases (TFRS 16): a contract header and its periods, accrued by time and collected separately.
CREATE TABLE lease (
    tenant          text    NOT NULL,
    id              text    NOT NULL,
    party           text    NOT NULL,
    kind            text    NOT NULL,
    currency        char(3) NOT NULL,
    deposit_account text    NOT NULL,
    start_date      date    NOT NULL,
    asset_cost      bigint  NOT NULL,
    residual        bigint  NOT NULL,
    status          text    NOT NULL,
    PRIMARY KEY (tenant, id)
);
CREATE TABLE lease_period (
    tenant          text    NOT NULL,
    lease_id        text    NOT NULL,
    number          integer NOT NULL,
    due_date        date    NOT NULL,
    payment         bigint  NOT NULL,
    income          bigint  NOT NULL,
    rent_recognised bigint  NOT NULL,
    depreciation    bigint  NOT NULL,
    accrued         boolean NOT NULL,
    paid            bigint  NOT NULL,
    PRIMARY KEY (tenant, lease_id, number),
    FOREIGN KEY (tenant, lease_id) REFERENCES lease (tenant, id)
);
CREATE INDEX ix_lease_party ON lease (tenant, party);
