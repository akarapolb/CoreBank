package org.fabor.lending;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.function.BiFunction;
import org.fabor.engine.product.ProductDefinition;
import org.fabor.engine.product.ProductLoader;
import org.fabor.ledger.application.LedgerService;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.ledger.domain.Direction;
import org.fabor.ledger.domain.Entry;
import org.fabor.ledger.domain.PostingBatch;
import org.fabor.ledger.testkit.InMemoryLedgerStore;
import org.fabor.lending.CollectionEvent.Channel;
import org.fabor.lending.CollectionsService.Action;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.IdempotencyKey;
import org.fabor.platform.tenancy.TenantId;
import org.fabor.platform.time.BusinessCalendar;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class CollectionsServiceTest {
    static final TenantId T = new TenantId("bank-a");
    static final LocalDate D0 = LocalDate.of(2026, 1, 15);

    private ProductDefinition product;
    private LoanService loans;
    private CollectionsService collections;

    @BeforeEach
    void setUp() throws IOException {
        String yaml;
        try (var in = CollectionsServiceTest.class.getResourceAsStream("/personal-loan.yaml")) {
            yaml = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
        product = ProductLoader.parse(yaml);
        LedgerService ledger = new LedgerService(new InMemoryLedgerStore(),
                Clock.fixed(Instant.parse("2026-12-31T00:00:00Z"), ZoneOffset.UTC));
        LoanRepo repo = new LoanRepo.InMemory();
        BiFunction<String, Integer, ProductDefinition> products = (c, v) -> c.equals(product.product()) && v == 1 ? product : null;
        loans = new LoanService(T, ledger, repo, products, BusinessCalendar.monToFri(Set.of()));
        collections = new CollectionsService(repo, new CollectionRepo.InMemory(), products);
        ledger.post(PostingBatch.of(T, new BatchId("seed"), new IdempotencyKey("seed"), D0.minusDays(30), List.of(
                new Entry(new AccountId("gl:cash"), BalanceType.SETTLED, Direction.DEBIT, Money.ofMinor(50_000_000, Currency.THB)),
                new Entry(new AccountId("dep:D1"), BalanceType.SETTLED, Direction.CREDIT, Money.ofMinor(50_000_000, Currency.THB)))));
    }

    private Loan open(String id, String amount) {
        return loans.disburse(id, "party-" + id, "PERSONAL_LOAN_STD", 1, Money.of(new BigDecimal(amount), Currency.THB), 12, D0, "D1");
    }

    @Test
    void nothingIsQueuedUntilAnInstalmentIsBilledAndPastDue() {
        Loan l = open("L1", "100000");
        LocalDate due1 = l.instalments().get(0).dueDate();
        assertThat(collections.queue(due1.plusDays(5))).isEmpty();            // not billed: nothing overdue
        loans.bill("L1", 1, due1);
        assertThat(collections.queue(due1)).isEmpty();                        // due today is not late
        assertThat(collections.status("L1", due1)).isEmpty();
        var item = collections.status("L1", due1.plusDays(5)).orElseThrow();
        assertThat(item.daysPastDue()).isEqualTo(5);
        assertThat(item.overdue()).isEqualTo(l.instalments().get(0).principalDue() + l.instalments().get(0).interestDue());
        assertThat(item.recommended()).isEqualTo(Action.REMIND);
        assertThat(item.bucket()).isEqualTo(1);
    }

    @Test
    void theRecommendationEscalatesWithDaysPastDueAndTheProductThresholds() {
        Loan l = open("L1", "100000");
        LocalDate due1 = l.instalments().get(0).dueDate();
        loans.bill("L1", 1, due1);
        assertThat(collections.status("L1", due1.plusDays(29)).orElseThrow().recommended()).isEqualTo(Action.REMIND);
        assertThat(collections.status("L1", due1.plusDays(30)).orElseThrow().recommended()).isEqualTo(Action.CALL);
        assertThat(collections.status("L1", due1.plusDays(60)).orElseThrow().recommended()).isEqualTo(Action.LETTER);
        assertThat(collections.status("L1", due1.plusDays(89)).orElseThrow().recommended()).isEqualTo(Action.LETTER);
        assertThat(collections.status("L1", due1.plusDays(90)).orElseThrow().recommended()).isEqualTo(Action.RESTRUCTURE_REVIEW);
        assertThat(collections.status("L1", due1.plusDays(359)).orElseThrow().recommended()).isEqualTo(Action.RESTRUCTURE_REVIEW);
        assertThat(collections.status("L1", due1.plusDays(360)).orElseThrow().recommended()).isEqualTo(Action.WRITE_OFF_REVIEW);
    }

    @Test
    void withoutDelinquencyConfigurationTheDefaultBucketsApplyAndFieldVisitComesLast() throws IOException {
        String yaml;
        try (var in = CollectionsServiceTest.class.getResourceAsStream("/personal-loan.yaml")) {
            yaml = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
        product = ProductLoader.parse(yaml.replaceAll("(?s)delinquency:.*?accounting:", "accounting:"));
        Loan l = open("L1", "100000");
        LocalDate due1 = l.instalments().get(0).dueDate();
        loans.bill("L1", 1, due1);
        assertThat(collections.status("L1", due1.plusDays(100)).orElseThrow().recommended()).isEqualTo(Action.FIELD_VISIT);
        assertThat(collections.status("L1", due1.plusDays(100)).orElseThrow().bucket()).isEqualTo(90);
    }

    @Test
    void theQueueIsOrderedByDaysPastDueThenAmountAndContactsAreLogged() {
        Loan a = open("L1", "100000");
        Loan b = open("L2", "200000");
        LocalDate due1 = a.instalments().get(0).dueDate();
        loans.bill("L1", 1, due1);
        loans.bill("L2", 1, due1);
        List<CollectionsService.Item> q = collections.queue(due1.plusDays(10));
        assertThat(q).extracting(CollectionsService.Item::loanId).containsExactly("L2", "L1");     // same days, larger amount first
        collections.recordContact("L1", "c1", due1.plusDays(2), Channel.CALL, "no answer");
        collections.recordContact("L1", "c2", due1.plusDays(4), Channel.SMS, "sent reminder");
        assertThat(collections.recordContact("L1", "c1", due1.plusDays(9), Channel.LETTER, "again").channel()).isEqualTo(Channel.CALL);
        var item = collections.status("L1", due1.plusDays(10)).orElseThrow();
        assertThat(item.contacts()).isEqualTo(2);
        assertThat(item.lastContact()).isEqualTo(due1.plusDays(4));
        assertThat(collections.history("L1")).hasSize(2);
        assertThat(b.id()).isEqualTo("L2");
    }

    @Test
    void aPromiseIsOpenThenKeptWhenPaidOrBrokenWhenItsDatePasses() {
        Loan l = open("L1", "100000");
        LocalDate due1 = l.instalments().get(0).dueDate();
        loans.bill("L1", 1, due1);
        long overdue = l.instalments().get(0).principalDue() + l.instalments().get(0).interestDue();
        LocalDate made = due1.plusDays(3);
        assertThatThrownBy(() -> collections.recordPromise("L1", "p0", made, 0, made.plusDays(7), "x"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> collections.recordPromise("L1", "p0", made, overdue + 1, made.plusDays(7), "x"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> collections.recordPromise("L1", "p0", made, 1_000, made, "x"))
                .isInstanceOf(IllegalArgumentException.class);
        CollectionEvent p = collections.recordPromise("L1", "p1", made, 500_000, made.plusDays(7), "will pay Friday");
        assertThat(collections.recordPromise("L1", "p1", made, 1, made.plusDays(1), "retry").promisedAmount()).isEqualTo(500_000);
        assertThat(p.overdueAtPromise()).isEqualTo(overdue);
        var open = collections.status("L1", made.plusDays(2)).orElseThrow();
        assertThat(open.openPromiseBy()).isEqualTo(made.plusDays(7));
        assertThat(open.promiseBroken()).isFalse();
        var broken = collections.status("L1", made.plusDays(8)).orElseThrow();
        assertThat(broken.promiseBroken()).isTrue();
        assertThat(broken.openPromiseBy()).isNull();
        // paying what was promised keeps it, even after its date
        loans.repay("L1", "pay1", Money.ofMinor(500_000, Currency.THB), made.plusDays(5));
        var kept = collections.status("L1", made.plusDays(8)).orElseThrow();
        assertThat(kept.promiseBroken()).isFalse();
        assertThat(kept.openPromiseBy()).isNull();
    }

    @Test
    void aPromiseNeedsSomethingOverdueAndUnknownLoansAreRefused() {
        open("L1", "100000");
        assertThatThrownBy(() -> collections.recordPromise("L1", "p", D0, 1_000, D0.plusDays(5), "x"))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> collections.status("NOPE", D0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> collections.recordContact("NOPE", "c", D0, Channel.CALL, "x")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> collections.history("NOPE")).isInstanceOf(IllegalArgumentException.class);
    }
}
