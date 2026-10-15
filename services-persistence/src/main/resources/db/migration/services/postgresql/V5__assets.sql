-- Asset register: assets, insurance policies and title events; the dealer channel.
CREATE TABLE dealer (
    tenant          text          NOT NULL,
    id              text          NOT NULL,
    name            text          NOT NULL,
    tax_id          text          NOT NULL,
    status          text          NOT NULL,
    commission_rate numeric(7,6)  NOT NULL,
    PRIMARY KEY (tenant, id)
);
CREATE TABLE asset (
    tenant          text    NOT NULL,
    id              text    NOT NULL,
    kind            text    NOT NULL,
    make            text    NOT NULL,
    model           text    NOT NULL,
    serial_no       text    NOT NULL,
    engine_no       text,
    registration_no text,
    dealer_id       text    NOT NULL,
    currency        char(3) NOT NULL,
    cost            bigint  NOT NULL,
    contract_id     text,
    status          text    NOT NULL,
    location        text,
    condition       text    NOT NULL,
    title_holder    text    NOT NULL,
    PRIMARY KEY (tenant, id),
    UNIQUE (tenant, serial_no)
);
CREATE INDEX ix_asset_contract ON asset (tenant, contract_id);
CREATE INDEX ix_asset_status ON asset (tenant, status);
CREATE TABLE asset_policy (
    tenant      text    NOT NULL,
    asset_id    text    NOT NULL,
    insurer     text    NOT NULL,
    policy_no   text    NOT NULL,
    cover_from  date    NOT NULL,
    cover_to    date    NOT NULL,
    sum_insured bigint  NOT NULL,
    premium     bigint  NOT NULL,
    financed    boolean NOT NULL,
    PRIMARY KEY (tenant, asset_id, insurer, policy_no),
    FOREIGN KEY (tenant, asset_id) REFERENCES asset (tenant, id)
);
CREATE TABLE asset_title_event (
    tenant    text    NOT NULL,
    asset_id  text    NOT NULL,
    seq       bigserial,
    on_date   date    NOT NULL,
    from_holder text,
    to_holder text    NOT NULL,
    reference text    NOT NULL,
    note      text    NOT NULL,
    PRIMARY KEY (tenant, asset_id, seq),
    FOREIGN KEY (tenant, asset_id) REFERENCES asset (tenant, id)
);
