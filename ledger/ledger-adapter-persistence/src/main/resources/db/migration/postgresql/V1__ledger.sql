-- Immutable, bitemporal double-entry ledger. value_date = effective time, recorded_at = system time.
CREATE TABLE ledger_batch (
    tenant          text        NOT NULL,
    batch_id        text        NOT NULL,
    idem_key        text        NOT NULL,
    content_hash    text        NOT NULL,
    value_date      date        NOT NULL,
    recorded_at     timestamptz NOT NULL,
    reverses_batch  text,
    CONSTRAINT pk_ledger_batch PRIMARY KEY (tenant, batch_id),
    CONSTRAINT uq_ledger_batch_key UNIQUE (tenant, idem_key),
    CONSTRAINT uq_ledger_batch_reverses UNIQUE (tenant, reverses_batch)
);

CREATE TABLE ledger_entry (
    tenant       text        NOT NULL,
    batch_id     text        NOT NULL,
    seq          integer     NOT NULL,
    account      text        NOT NULL,
    balance_type text        NOT NULL,
    direction    text        NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
    minor        bigint      NOT NULL CHECK (minor > 0),
    currency     char(3)     NOT NULL,
    minor_units  smallint    NOT NULL,
    value_date   date        NOT NULL,
    recorded_at  timestamptz NOT NULL,
    CONSTRAINT pk_ledger_entry PRIMARY KEY (tenant, batch_id, seq),
    CONSTRAINT fk_ledger_entry_batch FOREIGN KEY (tenant, batch_id) REFERENCES ledger_batch (tenant, batch_id)
);

CREATE INDEX ix_ledger_entry_balance
    ON ledger_entry (tenant, account, balance_type, currency, value_date, recorded_at);

-- Rows are never updated or deleted; corrections are new reversing batches.
CREATE FUNCTION ledger_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'ledger rows are immutable';
END $$;

CREATE TRIGGER trg_ledger_batch_immutable BEFORE UPDATE OR DELETE ON ledger_batch
    FOR EACH ROW EXECUTE FUNCTION ledger_immutable();
CREATE TRIGGER trg_ledger_entry_immutable BEFORE UPDATE OR DELETE ON ledger_entry
    FOR EACH ROW EXECUTE FUNCTION ledger_immutable();
