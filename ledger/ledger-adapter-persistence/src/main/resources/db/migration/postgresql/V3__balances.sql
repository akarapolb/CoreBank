-- Maintained current balances (all committed entries, any value date). stripe > 0 only for hot accounts,
-- whose balance is spread over several rows so concurrent postings do not queue on one lock.
ALTER TABLE ledger_entry ADD COLUMN require_funds smallint NOT NULL DEFAULT 0;

CREATE TABLE ledger_balance (
    tenant       text     NOT NULL,
    account      text     NOT NULL,
    balance_type text     NOT NULL,
    currency     char(3)  NOT NULL,
    stripe       smallint NOT NULL DEFAULT 0,
    minor        bigint   NOT NULL,
    CONSTRAINT pk_ledger_balance PRIMARY KEY (tenant, account, balance_type, currency, stripe)
);

INSERT INTO ledger_balance (tenant, account, balance_type, currency, stripe, minor)
SELECT tenant, account, balance_type, currency, 0,
       SUM(CASE direction WHEN 'CREDIT' THEN minor ELSE -minor END)
FROM ledger_entry GROUP BY tenant, account, balance_type, currency;
