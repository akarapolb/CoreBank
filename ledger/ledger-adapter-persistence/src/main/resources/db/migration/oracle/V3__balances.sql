ALTER TABLE ledger_entry ADD (require_funds NUMBER(1) DEFAULT 0 NOT NULL);

CREATE TABLE ledger_balance (
    tenant       VARCHAR2(64)  NOT NULL,
    account      VARCHAR2(128) NOT NULL,
    balance_type VARCHAR2(16)  NOT NULL,
    currency     CHAR(3)       NOT NULL,
    stripe       NUMBER(5)     DEFAULT 0 NOT NULL,
    minor        NUMBER(19)    NOT NULL,
    CONSTRAINT pk_ledger_balance PRIMARY KEY (tenant, account, balance_type, currency, stripe)
);

INSERT INTO ledger_balance (tenant, account, balance_type, currency, stripe, minor)
SELECT tenant, account, balance_type, currency, 0,
       SUM(CASE direction WHEN 'CREDIT' THEN minor ELSE -minor END)
FROM ledger_entry GROUP BY tenant, account, balance_type, currency;
