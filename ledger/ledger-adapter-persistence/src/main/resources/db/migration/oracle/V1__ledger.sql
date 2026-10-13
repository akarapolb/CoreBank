-- Oracle 19c+/23ai equivalent of the PostgreSQL ledger schema. Same behaviour, vendor-specific types.
CREATE TABLE ledger_batch (
    tenant          VARCHAR2(64)  NOT NULL,
    batch_id        VARCHAR2(128) NOT NULL,
    idem_key        VARCHAR2(128) NOT NULL,
    content_hash    VARCHAR2(64)  NOT NULL,
    value_date      DATE          NOT NULL,
    recorded_at     TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    reverses_batch  VARCHAR2(128),
    CONSTRAINT pk_ledger_batch PRIMARY KEY (tenant, batch_id),
    CONSTRAINT uq_ledger_batch_key UNIQUE (tenant, idem_key)
);

-- Oracle treats (tenant, NULL) pairs as duplicates in a composite unique index, so only index reversals.
CREATE UNIQUE INDEX uq_ledger_batch_reverses
    ON ledger_batch (CASE WHEN reverses_batch IS NOT NULL THEN tenant END, reverses_batch);

CREATE TABLE ledger_entry (
    tenant       VARCHAR2(64)  NOT NULL,
    batch_id     VARCHAR2(128) NOT NULL,
    seq          NUMBER(10)    NOT NULL,
    account      VARCHAR2(128) NOT NULL,
    balance_type VARCHAR2(16)  NOT NULL,
    direction    VARCHAR2(6)   NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
    minor        NUMBER(19)    NOT NULL CHECK (minor > 0),
    currency     CHAR(3)       NOT NULL,
    minor_units  NUMBER(1)     NOT NULL,
    value_date   DATE          NOT NULL,
    recorded_at  TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_ledger_entry PRIMARY KEY (tenant, batch_id, seq),
    CONSTRAINT fk_ledger_entry_batch FOREIGN KEY (tenant, batch_id) REFERENCES ledger_batch (tenant, batch_id)
);

CREATE INDEX ix_ledger_entry_balance
    ON ledger_entry (tenant, account, balance_type, currency, value_date, recorded_at);

CREATE OR REPLACE TRIGGER trg_ledger_batch_immutable BEFORE UPDATE OR DELETE ON ledger_batch
BEGIN
    RAISE_APPLICATION_ERROR(-20001, 'ledger rows are immutable');
END;
/
CREATE OR REPLACE TRIGGER trg_ledger_entry_immutable BEFORE UPDATE OR DELETE ON ledger_entry
BEGIN
    RAISE_APPLICATION_ERROR(-20001, 'ledger rows are immutable');
END;
/
