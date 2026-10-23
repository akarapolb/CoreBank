-- Collections: contacts and promises to pay on delinquent loans, append only. The reference is chosen by the caller and
-- is unique per loan, so a retried request does not record twice.
CREATE TABLE collection_event (
    tenant              text    NOT NULL,
    loan_id             text    NOT NULL,
    reference           text    NOT NULL,
    seq                 bigint  GENERATED ALWAYS AS IDENTITY,
    event_date          date    NOT NULL,
    kind                text    NOT NULL,
    channel             text    NOT NULL,
    note                text,
    promised_amount     bigint  NOT NULL DEFAULT 0,
    pay_by              date,
    overdue_at_promise  bigint  NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant, loan_id, reference)
);
CREATE INDEX collection_event_loan ON collection_event (tenant, loan_id, seq);
