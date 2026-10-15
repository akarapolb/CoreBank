package org.fabor.assets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.fabor.ledger.application.LedgerService;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.testkit.InMemoryLedgerStore;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.TenantId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AssetRegisterTest {
    static final TenantId T = new TenantId("bank-a");
    static final LocalDate D0 = LocalDate.of(2026, 1, 15);

    private final Map<String, Boolean> contractSettled = new HashMap<>();
    private AssetRepo repo;
    private AssetService svc;
    private DealerRepo dealers;
    private DealerService dealerSvc;
    private LedgerService ledger;

    static Money thb(long minor) {
        return Money.ofMinor(minor, Currency.THB);
    }

    @BeforeEach
    void setUp() {
        contractSettled.clear();
        contractSettled.put("HP-1", false);
        contractSettled.put("LS-1", false);
        repo = new AssetRepo.InMemory();
        svc = new AssetService(repo, id -> contractSettled.containsKey(id)
                ? Optional.of(new AssetService.ContractState(id, contractSettled.get(id))) : Optional.empty());
        ledger = new LedgerService(new InMemoryLedgerStore(), Clock.fixed(Instant.parse("2030-12-31T00:00:00Z"), ZoneOffset.UTC));
        dealers = new DealerRepo.InMemory();
        dealerSvc = new DealerService(T, ledger, dealers, repo);
    }

    private Asset ordered() {
        return svc.order("A1", Asset.Kind.VEHICLE, "Isuzu", "FVM", " mpa1234567890abcd ", "DLR-1", thb(300_000_000), "Showroom Bangna");
    }

    private Asset active() {
        ordered();
        svc.deliver("A1", "1กก 1234", "ENG-1", D0);
        svc.addPolicy("A1", "Viriyah", "P-1", D0, D0.plusYears(1), thb(300_000_000), thb(1_200_000), true);
        return svc.activate("A1", "HP-1", D0, true);
    }

    private long bal(AccountId a) {
        return ledger.balance(T, a, BalanceType.SETTLED, Currency.THB, LocalDate.of(2040, 1, 1)).minor();
    }

    @Test
    void serialNumbersAreNormalisedAndUnique() {
        Asset a = ordered();
        assertThat(a.serialNo()).isEqualTo("MPA1234567890ABCD");
        assertThat(a.status()).isEqualTo(Asset.Status.ORDERED);
        assertThat(a.titleHolder()).isEqualTo(Asset.TitleHolder.LESSOR);
        assertThatThrownBy(this::ordered).isInstanceOf(IllegalStateException.class).hasMessageContaining("already exists");
        assertThatThrownBy(() -> svc.order("A2", Asset.Kind.VEHICLE, "Isuzu", "FVM", "mpa1234567890abcd", "DLR-1", thb(1), "x"))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("serial number");
        for (String bad : new String[] {null, "  ", "X".repeat(41)}) {
            assertThatThrownBy(() -> svc.order("A3", Asset.Kind.EQUIPMENT, "Kubota", "L5018", bad, "DLR-1", thb(1), "x"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
        assertThatThrownBy(() -> svc.order("", Asset.Kind.EQUIPMENT, "Kubota", "L5018", "S1", "DLR-1", thb(1), "x"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.order("A4", Asset.Kind.EQUIPMENT, " ", "L5018", "S1", "DLR-1", thb(1), "x"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.order("A5", Asset.Kind.EQUIPMENT, "Kubota", null, "S1", "DLR-1", thb(1), "x"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.order("A6", Asset.Kind.EQUIPMENT, "Kubota", "L5018", "S1", "DLR-1", thb(0), "x"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void deliveryNeedsARegistrationForVehiclesAndRegistersTheTitleWithTheLessor() {
        ordered();
        assertThatThrownBy(() -> svc.deliver("A1", " ", null, D0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.deliver("A1", null, null, D0)).isInstanceOf(IllegalArgumentException.class);
        Asset d = svc.deliver("A1", "1กก 1234 ", "ENG-1", D0);
        assertThat(d.status()).isEqualTo(Asset.Status.DELIVERED);
        assertThat(d.registrationNo()).isEqualTo("1กก 1234");
        assertThat(svc.titleHistory("A1")).singleElement().satisfies(e -> {
            assertThat(e.from()).isNull();
            assertThat(e.to()).isEqualTo(Asset.TitleHolder.LESSOR);
        });
        assertThatThrownBy(() -> svc.deliver("A1", "1กก 1234", null, D0)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> svc.deliver("NOPE", "x", null, D0)).isInstanceOf(IllegalArgumentException.class);
        // equipment has no registration number
        svc.order("E1", Asset.Kind.EQUIPMENT, "Kubota", "L5018", "SN-9", "DLR-1", thb(50_000_000), "Yard");
        assertThat(svc.deliver("E1", null, null, D0).registrationNo()).isNull();
        svc.order("E2", Asset.Kind.EQUIPMENT, "Kubota", "L5018", "SN-10", "DLR-1", thb(50_000_000), "Yard");
        assertThat(svc.deliver("E2", "  ", null, D0).registrationNo()).isNull();
    }

    @Test
    void activationNeedsAContractAndInsuranceWhenRequired() {
        ordered();
        svc.deliver("A1", "1กก 1234", "ENG-1", D0);
        assertThatThrownBy(() -> svc.activate("A1", "NOPE", D0, false)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.activate("A1", "HP-1", D0, true)).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("insurance");
        svc.addPolicy("A1", "Viriyah", "P-1", D0.plusDays(10), D0.plusYears(1), thb(1), thb(0), false);
        assertThatThrownBy(() -> svc.activate("A1", "HP-1", D0, true)).isInstanceOf(IllegalStateException.class); // starts later
        Asset a = svc.activate("A1", "HP-1", D0, false);                                                          // not required
        assertThat(a.status()).isEqualTo(Asset.Status.ACTIVE);
        assertThat(a.contractId()).isEqualTo("HP-1");
        assertThat(svc.assetsOf("HP-1")).extracting(Asset::id).containsExactly("A1");
        assertThatThrownBy(() -> svc.activate("A1", "HP-1", D0, false)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void insuranceCoverageLapsesAndExpiresAndIsRenewed() {
        active();
        assertThat(svc.coverage("A1", D0)).isPresent();
        assertThat(svc.coverage("A1", D0.minusDays(1))).isEmpty();
        assertThat(svc.coverage("A1", D0.plusYears(1))).isPresent();          // the last day is covered
        assertThat(svc.coverage("A1", D0.plusYears(1).plusDays(1))).isEmpty();
        assertThat(svc.uninsured(D0.plusMonths(6))).isEmpty();
        assertThat(svc.uninsured(D0.plusYears(1).plusDays(1))).extracting(Asset::id).containsExactly("A1");
        // 30 days before the end the cover is expiring; a renewal clears it
        LocalDate near = D0.plusYears(1).minusDays(20);
        assertThat(svc.expiringCover(near, 30)).extracting(Asset::id).containsExactly("A1");
        assertThat(svc.expiringCover(D0.plusMonths(3), 30)).isEmpty();
        svc.addPolicy("A1", "Viriyah", "P-2", D0.plusYears(1).plusDays(1), D0.plusYears(2), thb(250_000_000), thb(1_100_000), false);
        assertThat(svc.expiringCover(near, 30)).isEmpty();
        assertThat(svc.coverage("A1", D0.plusYears(1).plusDays(1)).orElseThrow().policyNo()).isEqualTo("P-2");
        // overlapping policies: the one running longest is reported
        svc.addPolicy("A1", "Bangkok Ins", "B-1", D0, D0.plusYears(3), thb(1), thb(0), false);
        assertThat(svc.coverage("A1", D0.plusMonths(1)).orElseThrow().policyNo()).isEqualTo("B-1");
        // a recorded policy cannot be recorded again
        assertThatThrownBy(() -> svc.addPolicy("A1", "Viriyah", "P-2", D0, D0.plusYears(1), thb(1), thb(0), false))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("already recorded");
        // an asset with an expired policy and no cover on the day is not "expiring": it is uninsured
        svc.order("A9", Asset.Kind.VEHICLE, "Hino", "500", "S-9", "DLR-1", thb(1), "x");
        svc.deliver("A9", "9กก 9999", null, D0);
        svc.addPolicy("A9", "Viriyah", "P-9", D0, D0.plusDays(5), thb(1), thb(0), false);
        svc.activate("A9", "LS-1", D0, true);
        assertThat(svc.expiringCover(D0.plusDays(30), 10)).extracting(Asset::id).doesNotContain("A9");
        assertThat(svc.uninsured(D0.plusDays(30))).extracting(Asset::id).contains("A9");
        // an active asset with no policy at all is uninsured, not expiring
        svc.order("A10", Asset.Kind.VEHICLE, "Hino", "500", "S-10", "DLR-1", thb(1), "x");
        svc.deliver("A10", "9กก 1000", null, D0);
        svc.activate("A10", "LS-1", D0, false);
        assertThat(svc.expiringCover(D0, 10)).extracting(Asset::id).doesNotContain("A10");
    }

    @Test
    void policiesAreValidated() {
        active();
        assertThatThrownBy(() -> svc.addPolicy("A1", "", "P", D0, D0, thb(1), thb(0), false)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.addPolicy("A1", "V", " ", D0, D0, thb(1), thb(0), false)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.addPolicy("A1", null, "P", D0, D0, thb(1), thb(0), false)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.addPolicy("A1", "V", null, D0, D0, thb(1), thb(0), false)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.addPolicy("A1", "V", "P", D0, D0.minusDays(1), thb(1), thb(0), false))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.addPolicy("A1", "V", "P", null, D0, thb(1), thb(0), false)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.addPolicy("A1", "V", "P", D0, null, thb(1), thb(0), false)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.addPolicy("A1", "V", "P", D0, D0, thb(0), thb(0), false)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.addPolicy("A1", "V", "P", D0, D0, thb(1), thb(-1), false)).isInstanceOf(IllegalArgumentException.class);
        assertThat(svc.addPolicy("A1", "V", "P", D0, D0, thb(1), thb(0), false).covers(D0)).isTrue();
        assertThatThrownBy(() -> svc.addPolicy("NOPE", "V", "P", D0, D0, thb(1), thb(0), false)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void locationAndConditionCanChangeUntilTheAssetIsDisposedOf() {
        active();
        assertThat(svc.relocate("A1", "Customer yard, Rayong").location()).isEqualTo("Customer yard, Rayong");
        assertThat(svc.recondition("A1", Asset.Condition.FAIR).condition()).isEqualTo(Asset.Condition.FAIR);
        contractSettled.put("HP-1", true);
        svc.transferTitle("A1", D0.plusYears(5), "payoff");
        assertThatThrownBy(() -> svc.relocate("A1", "x")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> svc.recondition("A1", Asset.Condition.GOOD)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> svc.addPolicy("A1", "V", "P-77", D0, D0, thb(1), thb(0), false))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void theTitleStaysWithTheLessorUntilTheContractIsPaidOff() {
        active();
        assertThatThrownBy(() -> svc.transferTitle("A1", D0, "payoff")).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("paid off");
        contractSettled.put("HP-1", true);
        Asset moved = svc.transferTitle("A1", D0.plusYears(5), "payoff");
        assertThat(moved.titleHolder()).isEqualTo(Asset.TitleHolder.CUSTOMER);
        assertThat(moved.status()).isEqualTo(Asset.Status.DISPOSED);
        assertThat(svc.titleHistory("A1")).extracting(TitleEvent::to)
                .containsExactly(Asset.TitleHolder.LESSOR, Asset.TitleHolder.CUSTOMER);
        // the same call again is a no-op; a different reference is refused
        assertThat(svc.transferTitle("A1", D0.plusYears(5), "payoff")).isEqualTo(moved);
        assertThatThrownBy(() -> svc.transferTitle("A1", D0.plusYears(5), "other")).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already passed");
        assertThat(svc.titleHistory("A1")).hasSize(2);
        // an asset that is not active cannot pass its title
        svc.order("A2", Asset.Kind.EQUIPMENT, "Kubota", "L5018", "SN-2", "DLR-1", thb(1), "x");
        assertThatThrownBy(() -> svc.transferTitle("A2", D0, "x")).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not ACTIVE");
        assertThatThrownBy(() -> svc.transferTitle("NOPE", D0, "x")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void anAssetGoesBackToTheLessorAtTheEndOfALease() {
        active();
        assertThatThrownBy(() -> svc.returnToLessor("A1")).isInstanceOf(IllegalStateException.class).hasMessageContaining("not settled");
        contractSettled.put("HP-1", true);
        Asset back = svc.returnToLessor("A1");
        assertThat(back.status()).isEqualTo(Asset.Status.RETURNED);
        assertThat(back.titleHolder()).isEqualTo(Asset.TitleHolder.LESSOR);
        assertThatThrownBy(() -> svc.returnToLessor("A1")).isInstanceOf(IllegalStateException.class);
        assertThat(svc.find("A1")).contains(back);
        assertThat(svc.find("NOPE")).isEmpty();
        // a contract that vanished counts as not settled
        svc.order("A2", Asset.Kind.EQUIPMENT, "Kubota", "L5018", "SN-2", "DLR-1", thb(1), "x");
        svc.deliver("A2", null, null, D0);
        svc.activate("A2", "LS-1", D0, false);
        contractSettled.remove("LS-1");
        assertThatThrownBy(() -> svc.returnToLessor("A2")).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void dealersAreOnboardedSuspendedAndPaidOncePerAsset() {
        dealerSvc.onboard("DLR-1", "Siam Isuzu", "0105500000001", new BigDecimal("0.02"));
        assertThatThrownBy(() -> dealerSvc.onboard("DLR-1", "x", "1", BigDecimal.ZERO)).isInstanceOf(IllegalStateException.class);
        assertThat(dealerSvc.commission("DLR-1", thb(300_000_000))).isEqualTo(thb(6_000_000));
        assertThat(dealerSvc.all()).extracting(Dealer::id).containsExactly("DLR-1");
        assertThat(dealerSvc.find("DLR-1")).isPresent();
        assertThat(dealerSvc.find("NOPE")).isEmpty();
        assertThatThrownBy(() -> dealerSvc.commission("NOPE", thb(1))).isInstanceOf(IllegalArgumentException.class);
        // the supplier payable that a lease booking would have created
        ledger.post(org.fabor.ledger.domain.PostingBatch.of(T, new org.fabor.ledger.domain.BatchId("lease-book"),
                new org.fabor.platform.tenancy.IdempotencyKey("lease-book"), D0, List.of(
                        new org.fabor.ledger.domain.Entry(new AccountId("gl:leased-assets"), BalanceType.SETTLED,
                                org.fabor.ledger.domain.Direction.DEBIT, thb(300_000_000)),
                        new org.fabor.ledger.domain.Entry(DealerService.SUPPLIER_PAYABLE, BalanceType.SETTLED,
                                org.fabor.ledger.domain.Direction.CREDIT, thb(300_000_000)))));
        ordered();
        assertThatThrownBy(() -> dealerSvc.payDealer("A1", D0)).isInstanceOf(IllegalStateException.class).hasMessageContaining("active");
        svc.deliver("A1", "1กก 1234", null, D0);
        svc.activate("A1", "HP-1", D0, false);
        dealerSvc.suspend("DLR-1");
        assertThatThrownBy(() -> dealerSvc.payDealer("A1", D0)).isInstanceOf(IllegalStateException.class).hasMessageContaining("SUSPENDED");
        dealerSvc.reinstate("DLR-1");
        assertThat(dealerSvc.payDealer("A1", D0)).isEqualTo(thb(306_000_000));
        assertThat(bal(DealerService.SUPPLIER_PAYABLE)).isZero();                      // settled
        assertThat(-bal(DealerService.COMMISSION_DEFERRED)).isEqualTo(6_000_000);      // commission, deferred
        assertThat(bal(DealerService.CASH)).isEqualTo(306_000_000);                    // credit balance: cash paid out
        dealerSvc.payDealer("A1", D0);                                                 // paying again changes nothing
        assertThat(bal(DealerService.CASH)).isEqualTo(306_000_000);
        assertThatThrownBy(() -> dealerSvc.payDealer("NOPE", D0)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aDealerWithoutCommissionIsPaidTheCostOnly() {
        dealerSvc.onboard("DLR-1", "Cash Dealer", "0105500000002", BigDecimal.ZERO);
        ordered();
        svc.deliver("A1", "1กก 1234", null, D0);
        svc.activate("A1", "HP-1", D0, false);
        assertThat(dealerSvc.payDealer("A1", D0)).isEqualTo(thb(300_000_000));
        assertThat(-bal(DealerService.COMMISSION_DEFERRED)).isZero();
    }

    @Test
    void dealerRecordsAreValidated() {
        for (BigDecimal rate : new BigDecimal[] {null, new BigDecimal("-0.01"), new BigDecimal("0.21")}) {
            assertThatThrownBy(() -> new Dealer("D", "n", "t", Dealer.Status.ACTIVE, rate)).isInstanceOf(IllegalArgumentException.class);
        }
        assertThatThrownBy(() -> new Dealer("", "n", "t", Dealer.Status.ACTIVE, BigDecimal.ZERO)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Dealer("D", " ", "t", Dealer.Status.ACTIVE, BigDecimal.ZERO)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Dealer("D", "n", null, Dealer.Status.ACTIVE, BigDecimal.ZERO)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Dealer(null, "n", "t", Dealer.Status.ACTIVE, BigDecimal.ZERO)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Dealer("D", null, "t", Dealer.Status.ACTIVE, BigDecimal.ZERO)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> dealerSvc.suspend("NOPE")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void theRepositoryFindsAssetsByStatusAndContract() {
        active();
        svc.order("A2", Asset.Kind.EQUIPMENT, "Kubota", "L5018", "SN-2", "DLR-1", thb(1), "x");
        assertThat(repo.byStatus(Asset.Status.ORDERED)).extracting(Asset::id).containsExactly("A2");
        assertThat(repo.byStatus(Asset.Status.ACTIVE)).extracting(Asset::id).containsExactly("A1");
        assertThat(repo.byContract("HP-1")).extracting(Asset::id).containsExactly("A1");
        assertThat(repo.byContract("none")).isEmpty();
        assertThat(repo.findBySerial("SN-2")).isPresent();
        assertThat(repo.findBySerial("nope")).isEmpty();
        assertThat(repo.policies("A2")).isEmpty();
        assertThat(repo.titleEvents("A2")).isEmpty();
    }
}
