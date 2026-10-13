-- Per-shard due queue (ADR-0007). Workers lease rows with FOR UPDATE SKIP LOCKED.
CREATE TABLE scheduler_due (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant         text        NOT NULL,
    task_key       text        NOT NULL,
    task_type      text        NOT NULL,
    arrangement_id text        NOT NULL,
    payload        text        NOT NULL,
    due_at         timestamptz NOT NULL,
    lease_until    timestamptz,
    token          text,
    attempts       integer     NOT NULL DEFAULT 0,
    dead           boolean     NOT NULL DEFAULT false,
    last_error     text,
    CONSTRAINT uq_scheduler_due_key UNIQUE (tenant, task_key)
);

CREATE INDEX ix_scheduler_due_ready ON scheduler_due (due_at, id) WHERE NOT dead;
