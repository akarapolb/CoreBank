package org.fabor.deposit;

import java.util.Optional;

public interface DepositRepo {
    void save(DepositAccount account);

    Optional<DepositAccount> find(String id);

    /** Ids of all accounts, for operations such as scheduler backfill. */
    java.util.List<String> accountIds();

    /** Interest paid and tax withheld so far this year, for the tax exemption rule. */
    YearToDate yearToDate(String accountId, int year);

    void addYearToDate(String accountId, int year, long grossInterest, long withheld);

    record YearToDate(long grossInterest, long withheld) { }
}
