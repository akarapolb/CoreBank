-- Fleet master agreements: the facility, its rate card and the call-offs (schedules) drawn under it.
CREATE TABLE master_agreement (
    tenant            text    NOT NULL,
    id                text    NOT NULL,
    party             text    NOT NULL,
    currency          char(3) NOT NULL,
    facility_limit    bigint  NOT NULL,
    product_code      text    NOT NULL,
    product_version   integer NOT NULL,
    cross_default_dpd integer NOT NULL,
    status            text    NOT NULL,
    signed_on         date    NOT NULL,
    PRIMARY KEY (tenant, id)
);
CREATE TABLE master_rate_card (
    tenant        text         NOT NULL,
    master_id     text         NOT NULL,
    seq           integer      NOT NULL,
    vehicle_class text         NOT NULL,
    min_term      integer      NOT NULL,
    max_term      integer      NOT NULL,
    rate          numeric(9,6) NOT NULL,
    valid_from    date         NOT NULL,
    valid_to      date,
    PRIMARY KEY (tenant, master_id, seq),
    FOREIGN KEY (tenant, master_id) REFERENCES master_agreement (tenant, id)
);
CREATE TABLE master_schedule (
    tenant        text         NOT NULL,
    master_id     text         NOT NULL,
    loan_id       text         NOT NULL,
    seq           bigserial,
    vehicle_class text         NOT NULL,
    locked_rate   numeric(9,6) NOT NULL,
    term          integer      NOT NULL,
    called_off_on date         NOT NULL,
    asset_ids     text         NOT NULL,
    PRIMARY KEY (tenant, master_id, loan_id),
    FOREIGN KEY (tenant, master_id) REFERENCES master_agreement (tenant, id)
);
