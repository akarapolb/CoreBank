-- Tamper-evident audit chain: append-only, one writer at a time through the head row.
CREATE TABLE audit_log (
    seq         bigint      PRIMARY KEY,
    at          timestamptz NOT NULL,
    actor_type  text        NOT NULL,
    actor       text        NOT NULL,
    on_behalf_of text       NOT NULL,
    action      text        NOT NULL,
    subject     text        NOT NULL,
    detail      text        NOT NULL,
    prev_hash   text        NOT NULL,
    hash        text        NOT NULL
);
CREATE TABLE audit_head (id integer PRIMARY KEY CHECK (id = 1));
INSERT INTO audit_head VALUES (1);

CREATE FUNCTION services_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'rows are immutable';
END $$;
CREATE TRIGGER trg_audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION services_immutable();

CREATE TABLE pii_vault (
    tenant      text  NOT NULL,
    token       text  NOT NULL,
    key_id      text  NOT NULL,
    nonce       bytea NOT NULL,
    ciphertext  bytea NOT NULL,
    blind_index text  NOT NULL,
    PRIMARY KEY (tenant, token),
    CONSTRAINT uq_pii_vault_index UNIQUE (tenant, blind_index)
);

CREATE TABLE consent_event (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant         text        NOT NULL,
    party          text        NOT NULL,
    purpose        text        NOT NULL,
    at             timestamptz NOT NULL,
    purpose_version integer    NOT NULL,
    action         text        NOT NULL,
    channel        text        NOT NULL
);
CREATE INDEX ix_consent_party ON consent_event (tenant, party, purpose, at, id);
CREATE TRIGGER trg_consent_immutable BEFORE UPDATE OR DELETE ON consent_event
    FOR EACH ROW EXECUTE FUNCTION services_immutable();

CREATE TABLE party (
    tenant            text NOT NULL,
    id                text NOT NULL,
    name_token        text NOT NULL,
    national_id_token text NOT NULL,
    phone_token       text NOT NULL,
    date_of_birth     date NOT NULL,
    status            text NOT NULL,
    deposit_account   text,
    PRIMARY KEY (tenant, id)
);

CREATE TABLE deposit_account (
    tenant          text NOT NULL,
    id              text NOT NULL,
    party           text NOT NULL,
    product_code    text NOT NULL,
    product_version integer NOT NULL,
    currency        char(3) NOT NULL,
    PRIMARY KEY (tenant, id)
);
CREATE TABLE deposit_ytd (
    tenant   text   NOT NULL,
    account  text   NOT NULL,
    year     integer NOT NULL,
    gross    bigint NOT NULL,
    withheld bigint NOT NULL,
    PRIMARY KEY (tenant, account, year)
);

CREATE TABLE loan (
    tenant          text NOT NULL,
    id              text NOT NULL,
    party           text NOT NULL,
    product_code    text NOT NULL,
    product_version integer NOT NULL,
    currency        char(3) NOT NULL,
    deposit_account text NOT NULL,
    disbursed_on    date NOT NULL,
    principal       bigint NOT NULL,
    status          text NOT NULL,
    PRIMARY KEY (tenant, id)
);
CREATE TABLE loan_instalment (
    tenant          text    NOT NULL,
    loan_id         text    NOT NULL,
    number          integer NOT NULL,
    due_date        date    NOT NULL,
    principal_due   bigint  NOT NULL,
    interest_due    bigint  NOT NULL,
    principal_paid  bigint  NOT NULL,
    interest_paid   bigint  NOT NULL,
    penalty_accrued bigint  NOT NULL,
    penalty_paid    bigint  NOT NULL,
    billed          boolean NOT NULL,
    PRIMARY KEY (tenant, loan_id, number),
    FOREIGN KEY (tenant, loan_id) REFERENCES loan (tenant, id)
);
CREATE INDEX ix_loan_instalment_due ON loan_instalment (tenant, due_date) WHERE NOT billed;

CREATE TABLE catalog_draft (
    id            text PRIMARY KEY,
    product       text NOT NULL,
    version       integer NOT NULL,
    author        text NOT NULL,
    yaml          text NOT NULL,
    yaml_hash     text NOT NULL,
    status        text NOT NULL,
    reviewed_hash text,
    approvals     text NOT NULL
);
CREATE TABLE catalog_version (
    product      text NOT NULL,
    version      integer NOT NULL,
    yaml         text NOT NULL,
    yaml_hash    text NOT NULL,
    golden_hash  text NOT NULL,
    author       text NOT NULL,
    approvals    text NOT NULL,
    published_by text NOT NULL,
    published_at timestamptz NOT NULL,
    retired      boolean NOT NULL DEFAULT false,
    PRIMARY KEY (product, version)
);
