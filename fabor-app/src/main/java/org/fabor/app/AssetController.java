package org.fabor.app;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.fabor.assets.Asset;
import org.fabor.assets.AssetService;
import org.fabor.assets.Policy;
import org.fabor.assets.TitleEvent;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The asset register over HTTP: order, delivery, activation under a contract, insurance, title and the return of an
 * asset. Needs the asset-officer role. Amounts are minor units, as in the banking endpoints. Repossession and the sale
 * of a repossessed asset go through the repossession endpoints, which also settle the debt.
 */
@RestController
@RequestMapping("/api/v1/assets")
class AssetController {
    private static final String ROLE = "asset-officer";

    private final AssetService assets;

    AssetController(AssetService assets) {
        this.assets = assets;
    }

    record OrderRequest(String id, Asset.Kind kind, String make, String model, String serialNo, String dealerId,
                        long costMinor, String currency, String location) { }

    record DeliveryRequest(String registrationNo, String engineNo, LocalDate date) { }

    record ActivationRequest(String contractId, LocalDate date, boolean insuranceRequired) { }

    record PolicyRequest(String insurer, String policyNo, LocalDate from, LocalDate to, long sumInsuredMinor, long premiumMinor,
                         boolean financed, String currency) { }

    record LocationRequest(String location) { }

    record ConditionRequest(Asset.Condition condition) { }

    record TitleRequest(LocalDate date, String reference) { }

    @PostMapping
    Asset order(Actor actor, @RequestBody OrderRequest r) {
        actor.require(ROLE);
        if (r.kind() == null) {
            throw new IllegalArgumentException("kind is required");
        }
        return assets.order(r.id(), r.kind(), r.make(), r.model(), r.serialNo(), r.dealerId(), money(r.costMinor(), r.currency()),
                r.location());
    }

    @PostMapping("/{id}/delivery")
    Asset deliver(Actor actor, @PathVariable String id, @RequestBody DeliveryRequest r) {
        actor.require(ROLE);
        return assets.deliver(id, r.registrationNo(), r.engineNo(), r.date() == null ? LocalDate.now() : r.date());
    }

    @PostMapping("/{id}/activation")
    Asset activate(Actor actor, @PathVariable String id, @RequestBody ActivationRequest r) {
        actor.require(ROLE);
        return assets.activate(id, r.contractId(), r.date() == null ? LocalDate.now() : r.date(), r.insuranceRequired());
    }

    @PostMapping("/{id}/policies")
    Policy addPolicy(Actor actor, @PathVariable String id, @RequestBody PolicyRequest r) {
        actor.require(ROLE);
        return assets.addPolicy(id, r.insurer(), r.policyNo(), r.from(), r.to(), money(r.sumInsuredMinor(), r.currency()),
                money(r.premiumMinor(), r.currency()), r.financed());
    }

    @PostMapping("/{id}/location")
    Asset relocate(Actor actor, @PathVariable String id, @RequestBody LocationRequest r) {
        actor.require(ROLE);
        return assets.relocate(id, r.location());
    }

    @PostMapping("/{id}/condition")
    Asset recondition(Actor actor, @PathVariable String id, @RequestBody ConditionRequest r) {
        actor.require(ROLE);
        if (r.condition() == null) {
            throw new IllegalArgumentException("condition is required");
        }
        return assets.recondition(id, r.condition());
    }

    @PostMapping("/{id}/title-transfer")
    Asset transferTitle(Actor actor, @PathVariable String id, @RequestBody TitleRequest r) {
        actor.require(ROLE);
        if (r.reference() == null || r.reference().isBlank()) {
            throw new IllegalArgumentException("reference is required");
        }
        return assets.transferTitle(id, r.date() == null ? LocalDate.now() : r.date(), r.reference());
    }

    @PostMapping("/{id}/return")
    Asset returnToLessor(Actor actor, @PathVariable String id) {
        actor.require(ROLE);
        return assets.returnToLessor(id);
    }

    @GetMapping("/{id}")
    Asset one(Actor actor, @PathVariable String id) {
        actor.require(ROLE);
        return assets.find(id).orElseThrow(() -> new IllegalArgumentException("Unknown asset " + id));
    }

    @GetMapping("/{id}/title-history")
    List<TitleEvent> titleHistory(Actor actor, @PathVariable String id) {
        actor.require(ROLE);
        assets.find(id).orElseThrow(() -> new IllegalArgumentException("Unknown asset " + id));
        return assets.titleHistory(id);
    }

    @GetMapping("/{id}/coverage")
    Map<String, Object> coverage(Actor actor, @PathVariable String id,
                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate day) {
        actor.require(ROLE);
        assets.find(id).orElseThrow(() -> new IllegalArgumentException("Unknown asset " + id));
        LocalDate on = day == null ? LocalDate.now() : day;
        var policy = assets.coverage(id, on);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("assetId", id);
        out.put("day", on);
        out.put("covered", policy.isPresent());
        out.put("policy", policy.orElse(null));
        return out;
    }

    @GetMapping("/contract/{contractId}")
    List<Asset> ofContract(Actor actor, @PathVariable String contractId) {
        actor.require(ROLE);
        return assets.assetsOf(contractId);
    }

    @GetMapping("/uninsured")
    List<Asset> uninsured(Actor actor, @RequestParam(required = false)
                          @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate day) {
        actor.require(ROLE);
        return assets.uninsured(day == null ? LocalDate.now() : day);
    }

    @GetMapping("/expiring-cover")
    List<Asset> expiring(Actor actor, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate day,
                         @RequestParam(defaultValue = "30") int days) {
        actor.require(ROLE);
        return assets.expiringCover(day == null ? LocalDate.now() : day, days);
    }

    private static Money money(long minor, String currency) {
        return Money.ofMinor(minor, Currency.of(currency == null || currency.isBlank() ? "THB" : currency));
    }
}
