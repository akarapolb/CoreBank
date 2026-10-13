package org.fabor.deposit;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.function.BiFunction;
import org.fabor.engine.product.ProductDefinition;
import org.fabor.ledger.application.LedgerService;
import org.fabor.ledger.application.LedgerStore;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.ledger.domain.Direction;
import org.fabor.ledger.domain.Entry;
import org.fabor.ledger.domain.PostingBatch;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.IdempotencyKey;
import org.fabor.platform.tenancy.TenantId;

/**
 * Deposit accounts on the ledger. Balances live only in the ledger; this service adds the account register,
 * product rules and the interest cycle. Every posting has a deterministic id and key, so any call can be retried.
 */
public final class DepositService {
    public static final AccountId CLEARING = new AccountId("gl:deposit-clearing");
    public static final AccountId INTEREST_EXPENSE = new AccountId("gl:interest-expense");
    public static final AccountId WHT_PAYABLE = new AccountId("gl:wht-payable");
    private static final int DAY_BASIS = 365;

    private final TenantId tenant;
    private final LedgerService ledger;
    private final DepositRepo repo;
    private final BiFunction<String, Integer, ProductDefinition> products;
    private final Clock clock;

    public DepositService(TenantId tenant, LedgerService ledger, DepositRepo repo,
                          BiFunction<String, Integer, ProductDefinition> products, Clock clock) {
        this.tenant = tenant;
        this.ledger = ledger;
        this.repo = repo;
        this.products = products;
        this.clock = clock;
    }

    public DepositAccount open(String id, String party, String productCode, int productVersion) {
        ProductDefinition p = products.apply(productCode, productVersion);
        if (p == null || p.family() != ProductDefinition.Family.DEPOSIT) {
            throw new IllegalArgumentException("Not a deposit product: " + productCode + " v" + productVersion);
        }
        if (repo.find(id).isPresent()) {
            throw new IllegalStateException("Account already exists: " + id);
        }
        DepositAccount a = new DepositAccount(id, party, productCode, productVersion, p.currency());
        repo.save(a);
        return a;
    }

    public void deposit(String accountId, String reference, Money amount, LocalDate valueDate) {
        DepositAccount a = account(accountId);
        post(a, "dep-" + reference, valueDate, List.of(
                new Entry(CLEARING, BalanceType.SETTLED, Direction.DEBIT, amount),
                new Entry(acct(a), BalanceType.SETTLED, Direction.CREDIT, amount)));
    }

    /** Fails with InsufficientFundsException if the account would go below the product's minimum balance of zero. */
    public void withdraw(String accountId, String reference, Money amount, LocalDate valueDate) {
        DepositAccount a = account(accountId);
        post(a, "wd-" + reference, valueDate, List.of(
                Entry.guardedDebit(acct(a), BalanceType.SETTLED, amount),
                new Entry(CLEARING, BalanceType.SETTLED, Direction.CREDIT, amount)));
    }

    public Money balance(String accountId, LocalDate asOf) {
        DepositAccount a = account(accountId);
        return ledger.balance(tenant, acct(a), BalanceType.SETTLED, Currency.of(a.currency()), asOf);
    }

    /** Interest earned from {@code from} to {@code to} inclusive, computed from daily balances. Nothing is posted. */
    public Money accrued(String accountId, LocalDate from, LocalDate to) {
        DepositAccount a = account(accountId);
        ProductDefinition p = products.apply(a.productCode(), a.productVersion());
        List<AccrualCalculator.DayBalance> days = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            days.add(new AccrualCalculator.DayBalance(d, balance(accountId, d).minor()));
        }
        return AccrualCalculator.accrue(days, p.deposit(), Currency.of(a.currency()), DAY_BASIS);
    }

    /**
     * Posts the month's interest to the customer (net of withholding tax) in one balanced batch dated the last
     * day of the month. Safe to call again: the batch id and key are fixed per account and month.
     * @return gross interest posted (zero means nothing was posted)
     */
    public Money capitalize(String accountId, YearMonth month) {
        DepositAccount a = account(accountId);
        ProductDefinition p = products.apply(a.productCode(), a.productVersion());
        Currency cur = Currency.of(a.currency());
        LocalDate end = month.atEndOfMonth();
        if (end.isAfter(LocalDate.now(clock))) {
            throw new IllegalStateException("Month " + month + " has not ended");
        }
        var existing = ledger.find(tenant, batchId(a, "int-" + month));
        if (existing.isPresent()) { // already capitalized: report the same figure, post nothing
            return Money.ofMinor(existing.get().batch().entries().stream().filter(e -> e.account().equals(INTEREST_EXPENSE))
                    .mapToLong(e -> e.amount().minor()).sum(), Currency.of(a.currency()));
        }
        Money gross = accrued(accountId, month.atDay(1), end);
        if (gross.isZero()) {
            return gross;
        }
        Money wht = withholding(a, p, cur, month, gross);
        List<Entry> entries = new ArrayList<>();
        entries.add(new Entry(INTEREST_EXPENSE, BalanceType.SETTLED, Direction.DEBIT, gross));
        Money net = gross.minus(wht);
        if (!net.isZero()) {
            entries.add(new Entry(acct(a), BalanceType.SETTLED, Direction.CREDIT, net));
        }
        if (!wht.isZero()) {
            entries.add(new Entry(WHT_PAYABLE, BalanceType.SETTLED, Direction.CREDIT, wht));
        }
        LedgerStore.PostResult r = post(a, "int-" + month, end, entries);
        if (!r.replayed()) {
            repo.addYearToDate(a.id(), month.getYear(), gross.minor(), wht.minor());
        }
        return gross;
    }

    private Money withholding(DepositAccount a, ProductDefinition p, Currency cur, YearMonth month, Money gross) {
        var dep = p.deposit();
        if (dep.whtRate() == null || dep.whtRate().signum() == 0) {
            return Money.zero(cur);
        }
        var ytd = repo.yearToDate(a.id(), month.getYear());
        BigDecimal exempt = dep.whtExemptAnnual() == null ? BigDecimal.ZERO : dep.whtExemptAnnual();
        long exemptMinor = exempt.multiply(BigDecimal.TEN.pow(cur.minorUnits())).longValueExact();
        long totalGross = ytd.grossInterest() + gross.minor();
        if (totalGross <= exemptMinor) {
            return Money.zero(cur);
        }
        // once the year's interest passes the exemption, tax applies to all of it: catch up on earlier months
        long due = BigDecimal.valueOf(totalGross).multiply(dep.whtRate()).setScale(0, RoundingMode.HALF_UP).longValueExact()
                - ytd.withheld();
        return Money.ofMinor(Math.max(0, Math.min(due, gross.minor())), cur);
    }

    private BatchId batchId(DepositAccount a, String ref) {
        return new BatchId(a.id() + ":" + ref);
    }

    private LedgerStore.PostResult post(DepositAccount a, String ref, LocalDate valueDate, List<Entry> entries) {
        return ledger.post(PostingBatch.of(tenant, batchId(a, ref), new IdempotencyKey(a.id() + ":" + ref), valueDate, entries));
    }

    private static AccountId acct(DepositAccount a) {
        return new AccountId(a.ledgerId());
    }

    private DepositAccount account(String id) {
        return repo.find(id).orElseThrow(() -> new IllegalArgumentException("No such account " + id));
    }
}
