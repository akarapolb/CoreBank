-- Restructuring replaces a loan's rate and schedule: keep the override and a generation counter used in posting ids.
ALTER TABLE loan ADD COLUMN rate_override numeric(9,6);
ALTER TABLE loan ADD COLUMN generation integer NOT NULL DEFAULT 0;
