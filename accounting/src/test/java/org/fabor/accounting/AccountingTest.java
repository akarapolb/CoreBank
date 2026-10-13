package org.fabor.accounting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.fabor.ledger.api.BatchPostedEvent;
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
import org.junit.jupiter.api.Test;

class AccountingTest {
    static final TenantId T = new TenantId("bank-a");
    static final Set<Currency> CUR = Set.of(Currency.THB);
    final InMemoryLedgerStore ledger = new InMemoryLedgerStore();
    final GlProjection projection = new GlProjection(GlMapping.retailV1());
    final List<BatchPostedEvent> outbox = new ArrayList<>();

    private PostingBatch post(String id, List<Entry> entries) {
        PostingBatch b = PostingBatch.of(T, new BatchId(id), new IdempotencyKey(id), LocalDate.of(2026, 1, 1), entries);
        ledger.append(b, Instant.parse("2026-01-01T00:00:00Z"));
        outbox.add(event(b));
        return b;
    }

    static BatchPostedEvent event(PostingBatch b) {
        return new BatchPostedEvent(b.tenant().value(), b.id().value(), b.key().value(), b.valueDate().toString(),
                "2026-01-01T00:00:00Z", b.reverses().map(BatchId::value).orElse(""),
                b.entries().stream().map(e -> new BatchPostedEvent.Line(e.account().value(), e.type().name(),
                        e.direction().name(), e.amount().minor(), e.amount().currency().code())).toList());
    }

    static Entry e(String acct, Direction d, long minor) {
        return new Entry(new AccountId(acct), BalanceType.SETTLED, d, Money.ofMinor(minor, Currency.THB));
    }

    private void bookSomeActivity() {
        post("dep1", List.of(e("gl:deposit-clearing", Direction.DEBIT, 1_000_000), e("dep:A1", Direction.CREDIT, 1_000_000)));
        post("loan1", List.of(e("loan:L1:principal", Direction.DEBIT, 500_000), e("dep:A1", Direction.CREDIT, 495_000),
                e("gl:fee-income", Direction.CREDIT, 5_000)));
        post("bill1", List.of(e("loan:L1:interest", Direction.DEBIT, 7_500), e("gl:interest-income", Direction.CREDIT, 7_500)));
        // a hold moves value between buckets of one account; still the same GL liability
        post("hold1", List.of(e("dep:A1", Direction.DEBIT, 10_000),
                new Entry(new AccountId("dep:A1"), BalanceType.HOLD, Direction.CREDIT, Money.ofMinor(10_000, Currency.THB))));
        // a guarantee is off balance sheet
        post("gtee1", List.of(new Entry(new AccountId("dep:A1"), BalanceType.CONTINGENT, Direction.DEBIT, Money.ofMinor(1, Currency.THB)),
                new Entry(new AccountId("gl:cash"), BalanceType.CONTINGENT, Direction.CREDIT, Money.ofMinor(1, Currency.THB))));
    }

    @Test
    void cleanWhenProjectionHasEveryEvent() {
        bookSomeActivity();
        outbox.forEach(projection::apply);
        Reconciliation.Report r = Reconciliation.run(ledger, T, projection, CUR);
        assertThat(r.breaks()).isEmpty();
        assertThat(r.clean()).isTrue();
        assertThat(r.ledgerNetByCurrency().get("THB")).isZero();
        assertThat(projection.balance("bank-a", "2100", "THB")).isEqualTo(1_495_000);   // deposits: credit balance
        assertThat(projection.balance("bank-a", "1300", "THB")).isEqualTo(-500_000);    // loans: debit balance
        assertThat(projection.balance("bank-a", "4200", "THB")).isEqualTo(5_000);
    }

    @Test
    void duplicateDeliveryIsHarmlessAndMissingEventIsABreak() {
        bookSomeActivity();
        outbox.forEach(projection::apply);
        assertThat(projection.apply(outbox.get(0))).isFalse();           // redelivery
        assertThat(Reconciliation.run(ledger, T, projection, CUR).clean()).isTrue();

        GlProjection lossy = new GlProjection(GlMapping.retailV1());
        for (int i = 0; i < outbox.size(); i++) {
            if (!outbox.get(i).batchId().equals("bill1")) {               // the billing event never arrived
                lossy.apply(outbox.get(i));
            }
        }
        Reconciliation.Report r = Reconciliation.run(ledger, T, lossy, CUR);
        assertThat(r.clean()).isFalse();
        assertThat(r.breaks()).extracting(Reconciliation.Break::glCode).containsExactlyInAnyOrder("1310", "4100");
        assertThat(r.breaks().get(0).difference()).isNotZero();
    }

    @Test
    void phantomEventForAnAccountTheLedgerNeverSawIsABreak() {
        bookSomeActivity();
        outbox.forEach(projection::apply);
        projection.apply(new BatchPostedEvent("bank-a", "ghost", "g", "2026-01-01", "2026-01-01T00:00:00Z", "",
                List.of(new BatchPostedEvent.Line("gl:fee-income", "SETTLED", "CREDIT", 77, "THB"),
                        new BatchPostedEvent.Line("gl:cash", "SETTLED", "DEBIT", 77, "THB"))));
        Reconciliation.Report r = Reconciliation.run(ledger, T, projection, CUR);
        assertThat(r.breaks()).anyMatch(b -> b.glCode().equals("4200") && b.difference() == -77);
    }

    @Test
    void jsonFeedWorksAndUnmappedAccountsAreRejected() {
        bookSomeActivity();
        outbox.forEach(ev -> projection.applyJson(ev.toJson()));
        assertThat(Reconciliation.run(ledger, T, projection, CUR).clean()).isTrue();
        assertThatThrownBy(() -> projection.apply(new BatchPostedEvent("bank-a", "x", "x", "2026-01-01", "t", "",
                List.of(new BatchPostedEvent.Line("mystery:1", "SETTLED", "DEBIT", 1, "THB")))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("No GL mapping");
        assertThat(GlMapping.retailV1().name()).isEqualTo("retail_th_v1");
        assertThat(GlMapping.retailV1().map("dep:Z").type()).isEqualTo(GlAccount.Type.LIABILITY);
        assertThat(projection.snapshot()).isNotEmpty();
    }

    @Test
    void otherTenantsAreNotMixedIn() {
        bookSomeActivity();
        outbox.forEach(projection::apply);
        projection.apply(new BatchPostedEvent("bank-b", "b1", "b1", "2026-01-01", "t", "",
                List.of(new BatchPostedEvent.Line("dep:Q", "SETTLED", "CREDIT", 9, "THB"),
                        new BatchPostedEvent.Line("gl:cash", "SETTLED", "DEBIT", 9, "THB"))));
        assertThat(Reconciliation.run(ledger, T, projection, CUR).clean()).isTrue();
    }
}
