-- VAT added to an instalment bill: due when the instalment is billed, paid through the repayment waterfall.
ALTER TABLE loan_instalment ADD COLUMN vat_due bigint NOT NULL DEFAULT 0;
ALTER TABLE loan_instalment ADD COLUMN vat_paid bigint NOT NULL DEFAULT 0;
