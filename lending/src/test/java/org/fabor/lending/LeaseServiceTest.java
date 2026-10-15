package org.fabor.lending;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.fabor.engine.lease.FinanceLease;
import org.fabor.engine.schedule.Frequency;
import org.fabor.ledger.application.InsufficientFundsException;
import org.fabor.ledger.application.LedgerService;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.ledger.domain.Direction;
import org.fabor.ledger.domain.Entry;
import org.fabor.ledger.domain.PostingBatch;
import org.fabor.ledger.testkit.InMemoryLedgerStore;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.IdempotencyKey;
import org.fabor.platform.tenancy.TenantId;
import org.fabor.platform.time.BusinessCalendar;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LeaseServiceTest {
    static final TenantId T = new TenantId("bank-a");
    static final LocalDate START = LocalDate.of(2026, 1, 15);
    private LedgerService ledger;
    private LeaseService svc;

    static Money thb(long minor) {
        return Money.ofMinor(minor, Currency.THB);
    }

    @BeforeEach
    void setUp() {
        ledger = new LedgerService(new InMemoryLedgerStore(), Clock.fixed(Instant.parse("2030-12-31T00:00:00Z"), ZoneOffset.UTC));
        svc = new LeaseService(T, ledger, new LeaseRepo.InMemory(), BusinessCalendar.monToFri(Set.of()));
        fund("seed", 1_000_000_000L);
    }

    private void fund(String ref, long minor) {
        ledger.post(PostingBatch.of(T, new BatchId(ref), new IdempotencyKey(ref), START.minusDays(30), List.of(
                new Entry(new AccountId("gl:cash"), BalanceType.SETTLED, Direction.DEBIT, thb(minor)),
                new Entry(new AccountId("dep:D1"), BalanceType.SETTLED, Direction.CREDIT, thb(minor)))));
    }

    private long bal(AccountId a) {
        return ledger.balance(T, a, BalanceType.SETTLED, Currency.THB, LocalDate.of(2040, 1, 1)).minor();
    }

    private Lease finance() {
        // 1,000,000.00 asset, 36 monthly payments of 27,500.00 in arrears, 200,000.00 residual
        return svc.bookFinance("F1", "party-1", "D1", thb(100_000_000), thb(0), thb(2_750_000), 36, thb(20_000_000), START,
                Frequency.MONTHLY);
    }

    @Test
    void financeLeaseRecognisesNetInvestmentIncomeAndRunsOffToTheResidual() {
        Lease lease = finance();
        FinanceLease.Result plan = FinanceLease.fromPayment(thb(100_000_000), thb(0), thb(2_750_000), 36, thb(20_000_000),
                FinanceLease.Timing.ARREARS, 12);
        assertThat(lease.periods()).hasSize(36);
        assertThat(bal(LeaseService.netInvestment("F1"))).isEqualTo(-100_000_000);   // debit: asset
        assertThat(bal(LeaseService.SUPPLIER_PAYABLE)).isEqualTo(100_000_000);
        long totalIncome = 0;
        for (Lease.Period p : lease.periods()) {
            svc.accrue("F1", p.number(), p.dueDate());
            totalIncome += p.income();
            svc.collect("F1", "c" + p.number(), thb(p.payment()), p.dueDate());
            // after each period the net investment equals the plan's closing balance
            assertThat(-bal(LeaseService.netInvestment("F1"))).isEqualTo(plan.rows().get(p.number() - 1).closing().minor());
        }
        assertThat(totalIncome).isEqualTo(plan.totalIncome().minor());
        assertThat(bal(LeaseService.FINANCE_INCOME)).isEqualTo(plan.totalIncome().minor());
        assertThat(-bal(LeaseService.netInvestment("F1"))).isEqualTo(20_000_000);         // the residual is left
        assertThat(svc.find("F1").orElseThrow().status()).isEqualTo(Lease.Status.COMPLETED);
        assertThat(svc.due("F1").isZero()).isTrue();
    }

    @Test
    void incomeIsEarnedByTimeEvenWhenTheCustomerHasNotPaid() {
        Lease lease = finance();
        Lease.Period p1 = lease.periods().get(0);
        svc.accrue("F1", 1, p1.dueDate());
        assertThat(bal(LeaseService.FINANCE_INCOME)).isEqualTo(p1.income());
        assertThat(svc.due("F1")).isEqualTo(thb(p1.payment()));
        // not collected: the net investment has grown by the income
        assertThat(-bal(LeaseService.netInvestment("F1"))).isEqualTo(100_000_000 + p1.income());
        // partial payment, then the rest
        svc.collect("F1", "a", thb(1_000_000), p1.dueDate());
        assertThat(svc.due("F1")).isEqualTo(thb(p1.payment() - 1_000_000));
        svc.collect("F1", "b", thb(p1.payment() - 1_000_000), p1.dueDate());
        assertThat(svc.due("F1").isZero()).isTrue();
        assertThat(svc.find("F1").orElseThrow().status()).isEqualTo(Lease.Status.ACTIVE);
    }

    @Test
    void retriesAndMisuseAreSafe() {
        Lease lease = finance();
        LocalDate d1 = lease.periods().get(0).dueDate();
        assertThatThrownBy(this::finance).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> svc.accrue("F1", 1, d1.minusDays(1))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.accrue("F1", 2, lease.periods().get(1).dueDate())).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> svc.accrue("NOPE", 1, d1)).isInstanceOf(IllegalArgumentException.class);
        svc.accrue("F1", 1, d1);
        long income = bal(LeaseService.FINANCE_INCOME);
        svc.accrue("F1", 1, d1); // retry: nothing is booked twice
        assertThat(bal(LeaseService.FINANCE_INCOME)).isEqualTo(income);
        long payment = lease.periods().get(0).payment();
        svc.collect("F1", "r1", thb(payment), d1);
        long invested = bal(LeaseService.netInvestment("F1"));
        svc.collect("F1", "r1", thb(payment), d1); // same reference: not applied again
        assertThat(bal(LeaseService.netInvestment("F1"))).isEqualTo(invested);
        assertThatThrownBy(() -> svc.collect("F1", "r2", thb(1), d1)).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("exceeds");
        assertThatThrownBy(() -> svc.collect("F1", "r3", thb(0), d1)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void collectionNeedsFundsInTheDepositAccount() {
        Lease lease = finance();
        LocalDate d1 = lease.periods().get(0).dueDate();
        svc.accrue("F1", 1, d1);
        Lease poor = svc.bookFinance("F2", "party-2", "EMPTY", thb(10_000_000), thb(0), thb(300_000), 36, thb(1_000_000),
                START, Frequency.MONTHLY);
        svc.accrue("F2", 1, poor.periods().get(0).dueDate());
        assertThatThrownBy(() -> svc.collect("F2", "x", thb(poor.periods().get(0).payment()), d1))
                .isInstanceOf(InsufficientFundsException.class);
        assertThat(svc.due("F2").minor()).isEqualTo(poor.periods().get(0).payment()); // nothing changed
    }

    @Test
    void operatingLeaseKeepsTheAssetDepreciatesAndSpreadsRent() {
        // 600,000.00 vehicle, residual 300,000.00, 6 monthly rents with a free first month and a step up
        List<Money> rents = List.of(thb(0), thb(5_000_000), thb(5_000_000), thb(5_000_000), thb(7_000_000), thb(7_000_000));
        Lease lease = svc.bookOperating("O1", "party-1", "D1", thb(60_000_000), thb(30_000_000), rents, START, Frequency.MONTHLY);
        assertThat(bal(LeaseService.LEASED_ASSETS)).isEqualTo(-60_000_000);
        long totalRent = 29_000_000;
        // period 1 is a free month: nothing is billed, but straight-line rent is still recognised (accrued rent)
        svc.accrue("O1", 1, lease.periods().get(0).dueDate());
        assertThat(bal(LeaseService.rentReceivable("O1"))).isZero();
        long recognised1 = lease.periods().get(0).rentRecognised();
        assertThat(recognised1).isBetween(totalRent / 6, totalRent / 6 + 1);       // 29,000,000 / 6, remainder allocated
        assertThat(-bal(LeaseService.accruedRent("O1"))).isEqualTo(recognised1);
        assertThat(bal(LeaseService.RENTAL_INCOME)).isEqualTo(recognised1);
        for (int n = 2; n <= 6; n++) {
            svc.accrue("O1", n, lease.periods().get(n - 1).dueDate());
        }
        // all rent is recognised over the term whatever the billing, and the accrued-rent position nets back to zero
        assertThat(bal(LeaseService.RENTAL_INCOME)).isEqualTo(totalRent);
        assertThat(bal(LeaseService.accruedRent("O1"))).isZero();
        // customer owes what was billed; paying it clears the receivable
        assertThat(svc.due("O1")).isEqualTo(thb(totalRent));
        for (int n = 2; n <= 6; n++) {
            svc.collect("O1", "c" + n, thb(lease.periods().get(n - 1).payment()), lease.periods().get(n - 1).dueDate());
        }
        assertThat(bal(LeaseService.rentReceivable("O1"))).isZero();
        assertThat(svc.find("O1").orElseThrow().status()).isEqualTo(Lease.Status.COMPLETED);
        // the asset is depreciated down to its residual value
        assertThat(-bal(LeaseService.LEASED_ASSETS) - bal(LeaseService.ACCUMULATED_DEPRECIATION)).isEqualTo(30_000_000);
        assertThat(-bal(LeaseService.DEPRECIATION_EXPENSE)).isEqualTo(30_000_000);
    }

    @Test
    void operatingLeaseWithDecreasingRentDefersIncome() {
        // rents fall over time, so early periods bill more than they recognise: the difference is deferred rent
        List<Money> rents = List.of(thb(9_000_000), thb(3_000_000));
        Lease lease = svc.bookOperating("O2", "party-1", "D1", thb(20_000_000), thb(10_000_000), rents, START, Frequency.MONTHLY);
        svc.accrue("O2", 1, lease.periods().get(0).dueDate());
        assertThat(bal(LeaseService.accruedRent("O2"))).isEqualTo(3_000_000);      // credit: deferred rent, billed 9m recognised 6m
        assertThat(bal(LeaseService.RENTAL_INCOME)).isEqualTo(6_000_000);
        svc.accrue("O2", 2, lease.periods().get(1).dueDate());
        assertThat(bal(LeaseService.RENTAL_INCOME)).isEqualTo(12_000_000);
        assertThat(bal(LeaseService.accruedRent("O2"))).isZero();                   // billed 3m, recognised 6m: caught up
    }

    @Test
    void leasesAreListedByParty() {
        finance();
        svc.bookOperating("O1", "party-1", "D1", thb(20_000_000), thb(10_000_000), List.of(thb(1_000_000)), START, Frequency.MONTHLY);
        svc.bookOperating("O9", "party-9", "D1", thb(20_000_000), thb(10_000_000), List.of(thb(1_000_000)), START, Frequency.MONTHLY);
        LeaseRepo repo = new LeaseRepo.InMemory();
        for (String id : List.of("F1", "O1", "O9")) {
            repo.save(svc.find(id).orElseThrow());
        }
        assertThat(repo.idsByParty("party-1")).containsExactly("O1", "F1");
        assertThat(repo.find("NOPE")).isEmpty();
        List<Lease.Period> none = new ArrayList<>();
        assertThat(svc.find("F1").orElseThrow().withPeriods(none, Lease.Status.COMPLETED).periods()).isEmpty();
    }
}
