package org.fabor.app;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.fabor.engine.schedule.Frequency;
import org.fabor.lending.Lease;
import org.fabor.lending.LeaseService;
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
 * Leases (TFRS 16) over HTTP: book a finance or operating lease, accrue its periods, collect from the customer, end a
 * finance lease early or let the lessee buy the asset. Needs the lease-officer role. Amounts are minor units; the
 * currency of an existing lease comes from the lease itself.
 */
@RestController
@RequestMapping("/api/v1/leases")
class LeaseController {
    private static final String ROLE = "lease-officer";

    private final LeaseService leases;

    LeaseController(LeaseService leases) {
        this.leases = leases;
    }

    record FinanceRequest(String id, String party, String depositAccountId, long fairValueMinor, long directCostsMinor,
                          long paymentMinor, int periods, long residualMinor, LocalDate start, Frequency frequency,
                          String currency) { }

    record OperatingRequest(String id, String party, String depositAccountId, long assetCostMinor, long residualMinor,
                            List<Long> rentsMinor, LocalDate start, Frequency frequency, String currency) { }

    record CollectRequest(String reference, long amountMinor, LocalDate date) { }

    record TerminateRequest(String reference, long feeMinor, LocalDate date) { }

    record PurchaseRequest(String reference, long priceMinor, LocalDate date) { }

    @PostMapping("/finance")
    Lease bookFinance(Actor actor, @RequestBody FinanceRequest r) {
        actor.require(ROLE);
        Currency cur = currency(r.currency());
        return leases.bookFinance(r.id(), r.party(), r.depositAccountId(), Money.ofMinor(r.fairValueMinor(), cur),
                Money.ofMinor(r.directCostsMinor(), cur), Money.ofMinor(r.paymentMinor(), cur), r.periods(),
                Money.ofMinor(r.residualMinor(), cur), required(r.start(), "start"), frequency(r.frequency()));
    }

    @PostMapping("/operating")
    Lease bookOperating(Actor actor, @RequestBody OperatingRequest r) {
        actor.require(ROLE);
        if (r.rentsMinor() == null || r.rentsMinor().isEmpty()) {
            throw new IllegalArgumentException("rentsMinor is required");
        }
        Currency cur = currency(r.currency());
        return leases.bookOperating(r.id(), r.party(), r.depositAccountId(), Money.ofMinor(r.assetCostMinor(), cur),
                Money.ofMinor(r.residualMinor(), cur), r.rentsMinor().stream().map(m -> Money.ofMinor(m, cur)).toList(),
                required(r.start(), "start"), frequency(r.frequency()));
    }

    @PostMapping("/{id}/accrual/{number}")
    Lease accrue(Actor actor, @PathVariable String id, @PathVariable int number,
                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOf) {
        actor.require(ROLE);
        return leases.accrue(id, number, asOf == null ? LocalDate.now() : asOf);
    }

    @PostMapping("/{id}/collections")
    Lease collect(Actor actor, @PathVariable String id, @RequestBody CollectRequest r) {
        actor.require(ROLE);
        return leases.collect(id, reference(r.reference()), money(id, r.amountMinor()), r.date() == null ? LocalDate.now() : r.date());
    }

    @PostMapping("/{id}/termination")
    Lease terminate(Actor actor, @PathVariable String id, @RequestBody TerminateRequest r) {
        actor.require(ROLE);
        return leases.terminate(id, reference(r.reference()), money(id, r.feeMinor()), r.date() == null ? LocalDate.now() : r.date());
    }

    @PostMapping("/{id}/purchase")
    Lease purchase(Actor actor, @PathVariable String id, @RequestBody PurchaseRequest r) {
        actor.require(ROLE);
        return leases.purchase(id, reference(r.reference()), money(id, r.priceMinor()), r.date() == null ? LocalDate.now() : r.date());
    }

    @GetMapping("/{id}")
    Lease one(Actor actor, @PathVariable String id) {
        actor.require(ROLE);
        return leases.find(id).orElseThrow(() -> new IllegalArgumentException("Unknown lease " + id));
    }

    @GetMapping("/{id}/due")
    Map<String, Object> due(Actor actor, @PathVariable String id) {
        actor.require(ROLE);
        Money due = leases.due(id);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("leaseId", id);
        out.put("dueMinor", due.minor());
        out.put("currency", due.currency().code());
        return out;
    }

    /** The net investment a finance lease carries on a day: what an early termination would clear. */
    @GetMapping("/{id}/carrying")
    Map<String, Object> carrying(Actor actor, @PathVariable String id,
                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        actor.require(ROLE);
        LocalDate on = date == null ? LocalDate.now() : date;
        Money carried = leases.carrying(id, on);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("leaseId", id);
        out.put("date", on);
        out.put("carryingMinor", carried.minor());
        out.put("currency", carried.currency().code());
        return out;
    }

    private Money money(String leaseId, long minor) {
        Lease l = leases.find(leaseId).orElseThrow(() -> new IllegalArgumentException("Unknown lease " + leaseId));
        return Money.ofMinor(minor, Currency.of(l.currency()));
    }

    private static Currency currency(String code) {
        return Currency.of(code == null || code.isBlank() ? "THB" : code);
    }

    private static Frequency frequency(Frequency f) {
        return f == null ? Frequency.MONTHLY : f;
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
