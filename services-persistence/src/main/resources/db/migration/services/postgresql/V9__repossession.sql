-- Repossession cases: the asset taken back from a defaulted loan and, once sold, what the sale did to the debt.
CREATE TABLE repossession (
    tenant          text    NOT NULL,
    reference       text    NOT NULL,
    loan_id         text    NOT NULL,
    asset_id        text    NOT NULL,
    repossessed_on  date    NOT NULL,
    location        text,
    status          text    NOT NULL,
    sold_on         date,
    proceeds        bigint  NOT NULL DEFAULT 0,
    costs           bigint  NOT NULL DEFAULT 0,
    owed            bigint  NOT NULL DEFAULT 0,
    shortfall       bigint  NOT NULL DEFAULT 0,
    surplus         bigint  NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant, reference)
);
CREATE INDEX repossession_loan ON repossession (tenant, loan_id, repossessed_on);
