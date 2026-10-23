package org.fabor.app;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.fabor.assets.AssetService;
import org.fabor.assets.Dealer;
import org.fabor.assets.DealerService;
import org.fabor.platform.money.Money;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The dealer channel over HTTP: onboard, suspend and reinstate a dealer, and pay a dealer for an active asset (which
 * settles the supplier payable and books the deferred commission). Needs the dealer-officer role.
 */
@RestController
@RequestMapping("/api/v1/dealers")
class DealerController {
    private static final String ROLE = "dealer-officer";

    private final DealerService dealers;
    private final AssetService assets;

    DealerController(DealerService dealers, AssetService assets) {
        this.dealers = dealers;
        this.assets = assets;
    }

    record OnboardRequest(String id, String name, String taxId, BigDecimal commissionRate) { }

    record PayRequest(String assetId, LocalDate date) { }

    @PostMapping
    Dealer onboard(Actor actor, @RequestBody OnboardRequest r) {
        actor.require(ROLE);
        return dealers.onboard(r.id(), r.name(), r.taxId(), r.commissionRate() == null ? BigDecimal.ZERO : r.commissionRate());
    }

    @PostMapping("/{id}/suspension")
    Dealer suspend(Actor actor, @PathVariable String id) {
        actor.require(ROLE);
        return dealers.suspend(id);
    }

    @PostMapping("/{id}/reinstatement")
    Dealer reinstate(Actor actor, @PathVariable String id) {
        actor.require(ROLE);
        return dealers.reinstate(id);
    }

    @GetMapping("/{id}")
    Dealer one(Actor actor, @PathVariable String id) {
        actor.require(ROLE);
        return dealers.find(id).orElseThrow(() -> new IllegalArgumentException("Unknown dealer " + id));
    }

    @GetMapping
    List<Dealer> all(Actor actor) {
        actor.require(ROLE);
        return dealers.all();
    }

    /** Pays the dealer of an asset: the whole cost, once per asset, with the commission deferred. */
    @PostMapping("/payments")
    Map<String, Object> pay(Actor actor, @RequestBody PayRequest r) {
        actor.require(ROLE);
        if (r.assetId() == null || r.assetId().isBlank()) {
            throw new IllegalArgumentException("assetId is required");
        }
        assets.find(r.assetId()).orElseThrow(() -> new IllegalArgumentException("Unknown asset " + r.assetId()));
        Money paid = dealers.payDealer(r.assetId(), r.date() == null ? LocalDate.now() : r.date());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("assetId", r.assetId());
        out.put("paidMinor", paid.minor());
        out.put("currency", paid.currency().code());
        return out;
    }
}
