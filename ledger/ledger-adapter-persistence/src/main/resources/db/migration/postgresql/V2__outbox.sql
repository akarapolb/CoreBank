-- Transactional outbox: written in the same transaction as the batch; Debezium relays it to Kafka.
CREATE TABLE ledger_outbox (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant       text        NOT NULL,
    aggregate_id text        NOT NULL,
    event_type   text        NOT NULL,
    payload      text        NOT NULL,
    created_at   timestamptz NOT NULL
);
CREATE TRIGGER trg_ledger_outbox_no_update BEFORE UPDATE ON ledger_outbox
    FOR EACH ROW EXECUTE FUNCTION ledger_immutable();
