package org.fabor.app;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.fabor.lending.FloorPlanLine;
import org.fabor.lending.FloorPlanService;
import org.fabor.lending.FloorPlanUnit;
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
 * Floor plan financing over HTTP: a dealer's revolving line, one drawdown per vehicle, interest, curtailments, repayment,
 * payoff on sale, and the stock audit. Needs the floorplan-officer role. Amounts are minor units; the currency of a unit
 * is the line's.
 */
@RestController
@RequestMapping("/api/v1/floorplans")
class FloorPlanController {
    private static final String ROLE = "floorplan-officer";

    private final FloorPlanService floorPlan;

    FloorPlanController(FloorPlanService floorPlan) {
        this.floorPlan = floorPlan;
    }

    record TermsRequest(long subLimitMinor, int interestFreeDays) { }

    record LineRequest(String id, String dealerId, String currency, long limitMinor, BigDecimal annualRate, int payoffWindowDays,
                       String settlementAccountId, Map<FloorPlanLine.UnitType, TermsRequest> terms,
                       List<FloorPlanLine.Step> curtailments, LocalDate signedOn) { }

    record DrawRequest(String unitId, FloorPlanLine.UnitType type, long amountMinor, LocalDate date, String supplierAccountId) { }

    record SaleRequest(LocalDate soldOn) { }

    record RepayRequest(String reference, long amountMinor, LocalDate date) { }

    record PayoffRequest(String reference, LocalDate date) { }

    record RetailRequest(String retailLoanId, String reference, LocalDate date) { }

    record AuditRequest(LocalDate asOf, Set<String> found) { }

    @PostMapping
    FloorPlanLine open(Actor actor, @RequestBody LineRequest r) {
        actor.require(ROLE);
        if (r.terms() == null || r.terms().isEmpty()) {
            throw new IllegalArgumentException("terms is required");
        }
        Map<FloorPlanLine.UnitType, FloorPlanLine.UnitTerms> terms = new LinkedHashMap<>();
        r.terms().forEach((type, t) -> terms.put(type, new FloorPlanLine.UnitTerms(t.subLimitMinor(), t.interestFreeDays())));
        return floorPlan.open(new FloorPlanLine(r.id(), r.dealerId(), currency(r.currency()), r.limitMinor(), r.annualRate(),
                r.payoffWindowDays(), r.settlementAccountId(), terms, r.curtailments() == null ? List.of() : r.curtailments(),
                FloorPlanLine.Status.ACTIVE, required(r.signedOn(), "signedOn")));
    }

    @PostMapping("/{id}/freeze")
    FloorPlanLine freeze(Actor actor, @PathVariable String id) {
        actor.require(ROLE);
        return floorPlan.freeze(id);
    }

    @PostMapping("/{id}/unfreeze")
    FloorPlanLine unfreeze(Actor actor, @PathVariable String id) {
        actor.require(ROLE);
        return floorPlan.unfreeze(id);
    }

    @PostMapping("/{id}/units")
    FloorPlanUnit draw(Actor actor, @PathVariable String id, @RequestBody DrawRequest r) {
        actor.require(ROLE);
        return floorPlan.draw(id, r.unitId(), required(r.type(), "type"), money(id, r.amountMinor()), required(r.date(), "date"),
                r.supplierAccountId());
    }

    @PostMapping("/{id}/units/{unitId}/accrual")
    FloorPlanUnit accrue(Actor actor, @PathVariable String id, @PathVariable String unitId,
                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate upTo) {
        actor.require(ROLE);
        return floorPlan.accrue(id, unitId, upTo == null ? LocalDate.now() : upTo);
    }

    @PostMapping("/{id}/units/{unitId}/sale")
    FloorPlanUnit sale(Actor actor, @PathVariable String id, @PathVariable String unitId, @RequestBody SaleRequest r) {
        actor.require(ROLE);
        return floorPlan.recordSale(id, unitId, r.soldOn() == null ? LocalDate.now() : r.soldOn());
    }

    @PostMapping("/{id}/units/{unitId}/repayments")
    FloorPlanUnit repay(Actor actor, @PathVariable String id, @PathVariable String unitId, @RequestBody RepayRequest r) {
        actor.require(ROLE);
        return floorPlan.repay(id, unitId, reference(r.reference()), money(id, r.amountMinor()),
                r.date() == null ? LocalDate.now() : r.date());
    }

    @PostMapping("/{id}/units/{unitId}/payoff")
    FloorPlanUnit payoff(Actor actor, @PathVariable String id, @PathVariable String unitId, @RequestBody PayoffRequest r) {
        actor.require(ROLE);
        return floorPlan.payoff(id, unitId, reference(r.reference()), r.date() == null ? LocalDate.now() : r.date());
    }

    @PostMapping("/{id}/units/{unitId}/retail-settlement")
    FloorPlanUnit settleFromRetail(Actor actor, @PathVariable String id, @PathVariable String unitId, @RequestBody RetailRequest r) {
        actor.require(ROLE);
        return floorPlan.settleFromRetailLoan(id, unitId, r.retailLoanId(), reference(r.reference()),
                r.date() == null ? LocalDate.now() : r.date());
    }

    @GetMapping
    List<FloorPlanLine> lines(Actor actor) {
        actor.require(ROLE);
        return floorPlan.lines();
    }

    @GetMapping("/{id}")
    FloorPlanLine line(Actor actor, @PathVariable String id) {
        actor.require(ROLE);
        return floorPlan.findLine(id).orElseThrow(() -> new IllegalArgumentException("Unknown line " + id));
    }

    @GetMapping("/{id}/units")
    List<FloorPlanUnit> units(Actor actor, @PathVariable String id) {
        actor.require(ROLE);
        return floorPlan.units(id);
    }

    @GetMapping("/{id}/units/{unitId}")
    FloorPlanUnit unit(Actor actor, @PathVariable String id, @PathVariable String unitId) {
        actor.require(ROLE);
        return floorPlan.findUnit(id, unitId).orElseThrow(() -> new IllegalArgumentException("Unknown unit " + unitId));
    }

    @GetMapping("/{id}/units/{unitId}/payoff-quote")
    Map<String, Object> payoffQuote(Actor actor, @PathVariable String id, @PathVariable String unitId,
                                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        actor.require(ROLE);
        LocalDate on = date == null ? LocalDate.now() : date;
        Money quote = floorPlan.payoffAmount(id, unitId, on);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("unitId", unitId);
        out.put("date", on);
        out.put("payoffMinor", quote.minor());
        out.put("principalDueMinor", floorPlan.principalDue(id, unitId, on));
        out.put("currency", quote.currency().code());
        return out;
    }

    @GetMapping("/{id}/statement")
    FloorPlanService.Statement statement(Actor actor, @PathVariable String id,
                                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOf) {
        actor.require(ROLE);
        return floorPlan.statement(id, asOf == null ? LocalDate.now() : asOf);
    }

    @GetMapping("/{id}/overdue-sales")
    List<FloorPlanUnit> overdueSales(Actor actor, @PathVariable String id,
                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOf) {
        actor.require(ROLE);
        return floorPlan.overdueSales(id, asOf == null ? LocalDate.now() : asOf);
    }

    @GetMapping("/{id}/exposure")
    Map<String, Object> exposure(Actor actor, @PathVariable String id) {
        actor.require(ROLE);
        Money e = floorPlan.exposure(id);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("lineId", id);
        out.put("exposureMinor", e.minor());
        out.put("currency", e.currency().code());
        return out;
    }

    /** A POST because it takes the list of unit ids found on the lot; it books nothing and can be repeated. */
    @PostMapping("/{id}/stock-audit")
    Map<String, Object> stockAudit(Actor actor, @PathVariable String id, @RequestBody AuditRequest r) {
        actor.require(ROLE);
        FloorPlanService.StockAudit a = floorPlan.stockAudit(id, r.asOf() == null ? LocalDate.now() : r.asOf(),
                r.found() == null ? Set.of() : r.found());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("lineId", a.lineId());
        out.put("asOf", a.asOf());
        out.put("checked", a.checked());
        out.put("missing", a.missing());
        out.put("saleOverdue", a.saleOverdue());
        out.put("unexpected", a.unexpected());
        out.put("soldOutOfTrust", a.soldOutOfTrust());
        out.put("clean", a.clean());
        return out;
    }

    private Money money(String lineId, long minor) {
        FloorPlanLine l = floorPlan.findLine(lineId).orElseThrow(() -> new IllegalArgumentException("Unknown line " + lineId));
        return Money.ofMinor(minor, Currency.of(l.currency()));
    }

    private static String currency(String code) {
        return code == null || code.isBlank() ? "THB" : code;
    }

    private static <T> T required(T value, String name) {
        if (value == null) {
            throw new IllegalArgumentException(name + " is required");
        }
        return value;
    }

    private static String reference(String reference) {
        if (reference == null || reference.isBlank()) {
            throw new IllegalArgumentException("reference is required");
        }
        return reference;
    }
}
