package org.fabor.app;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.fabor.assets.Asset;
import org.fabor.lending.LoanRepo;
import org.fabor.lending.Repossession;
import org.fabor.lending.RepossessionService;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Repossession and remarketing over HTTP. Taking an asset back and selling it both change a customer's debt, so they
 * need the repossession-officer role. Amounts are in major units (baht) in the request and converted with the loan's currency.
 */
@RestController
@RequestMapping("/api/v1/repossessions")
class RepossessionController {
    private final RepossessionService service;
    private final LoanRepo loans;

    RepossessionController(RepossessionService service, LoanRepo loans) {
        this.service = service;
        this.loans = loans;
    }

    record RepossessRequest(String reference, String loanId, String assetId, LocalDate date, String location,
                            Asset.Condition condition) { }

    record SaleRequest(LocalDate date, BigDecimal proceeds, BigDecimal costs) { }

    @PostMapping
    Repossession repossess(Actor actor, @RequestBody RepossessRequest r) {
        actor.require("repossession-officer");
        if (r.reference() == null || r.reference().isBlank() || r.loanId() == null || r.assetId() == null) {
            throw new IllegalArgumentException("reference, loanId and assetId are required");
        }
        return service.repossess(r.reference(), r.loanId(), r.assetId(), r.date() == null ? LocalDate.now() : r.date(),
                r.location(), r.condition() == null ? Asset.Condition.FAIR : r.condition());
    }

    @PostMapping("/{reference}/sale")
    Repossession sell(Actor actor, @PathVariable String reference, @RequestBody SaleRequest r) {
        actor.require("repossession-officer");
        Repossession found = service.find(reference).orElseThrow(() -> new IllegalArgumentException("Unknown repossession " + reference));
        Currency cur = Currency.of(loans.find(found.loanId()).orElseThrow().currency());
        if (r.proceeds() == null) {
            throw new IllegalArgumentException("proceeds is required");
        }
        return service.sell(reference, r.date() == null ? LocalDate.now() : r.date(), Money.of(r.proceeds(), cur),
                Money.of(r.costs() == null ? BigDecimal.ZERO : r.costs(), cur));
    }

    @GetMapping("/{reference}")
    Repossession one(Actor actor, @PathVariable String reference) {
        actor.require("repossession-officer");
        return service.find(reference).orElseThrow(() -> new IllegalArgumentException("Unknown repossession " + reference));
    }

    @GetMapping("/loan/{loanId}")
    List<Repossession> ofLoan(Actor actor, @PathVariable String loanId) {
        actor.require("repossession-officer");
        return service.forLoan(loanId);
    }
}
