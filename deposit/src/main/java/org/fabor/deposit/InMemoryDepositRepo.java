package org.fabor.deposit;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public final class InMemoryDepositRepo implements DepositRepo {
    private final Map<String, DepositAccount> accounts = new HashMap<>();
    private final Map<String, YearToDate> ytd = new HashMap<>();

    @Override
    public synchronized void save(DepositAccount a) {
        accounts.put(a.id(), a);
    }

    @Override
    public synchronized Optional<DepositAccount> find(String id) {
        return Optional.ofNullable(accounts.get(id));
    }

    @Override
    public synchronized YearToDate yearToDate(String accountId, int year) {
        return ytd.getOrDefault(accountId + "/" + year, new YearToDate(0, 0));
    }

    @Override
    public synchronized void addYearToDate(String accountId, int year, long gross, long withheld) {
        YearToDate cur = yearToDate(accountId, year);
        ytd.put(accountId + "/" + year, new YearToDate(cur.grossInterest() + gross, cur.withheld() + withheld));
    }
}
