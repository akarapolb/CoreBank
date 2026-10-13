package org.fabor.engine.schedule;

public enum Method {
    /** Equal instalments; {@code annualRate} is the nominal annual rate. */
    ANNUITY,
    /** Equal principal, declining interest. */
    EQUAL_PRINCIPAL,
    /** Interest each period, principal (and balloon) at the end. */
    BULLET,
    /** Equal instalments from a quoted flat rate; interest portions follow the implied EIR. */
    ANNUITY_FROM_FLAT
}
