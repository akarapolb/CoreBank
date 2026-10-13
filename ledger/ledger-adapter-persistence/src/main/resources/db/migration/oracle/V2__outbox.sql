CREATE TABLE ledger_outbox (
    id           NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant       VARCHAR2(64)  NOT NULL,
    aggregate_id VARCHAR2(128) NOT NULL,
    event_type   VARCHAR2(64)  NOT NULL,
    payload      CLOB          NOT NULL,
    created_at   TIMESTAMP(6) WITH TIME ZONE NOT NULL
);

CREATE OR REPLACE TRIGGER trg_ledger_outbox_no_update BEFORE UPDATE ON ledger_outbox
BEGIN
    RAISE_APPLICATION_ERROR(-20001, 'ledger rows are immutable');
END;
/
