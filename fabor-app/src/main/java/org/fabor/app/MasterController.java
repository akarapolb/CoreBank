package org.fabor.app;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.fabor.lending.ConsolidatedInvoice;
import org.fabor.lending.Loan;
import org.fabor.lending.MasterAgreement;
import org.fabor.lending.MasterService;
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
 * Fleet master agreements over HTTP: sign an agreement with its rate card, draw rate-locked call-offs against the
 * facility, bill and collect across all its schedules, and evaluate or cure cross-default. Needs the fleet-officer role.
 * Amounts are minor units in the agreement's currency.
 */
@RestController
@RequestMapping("/api/v1/masters")
class MasterController {
    private static final String ROLE = "fleet-officer";

    private final MasterService masters;
    private final Lifecycle lifecycle;

    MasterController(MasterService masters, Lifecycle lifecycle) {
        this.masters = masters;
        this.lifecycle = lifecycle;
    }

    record SignRequest(String id, String party, String currency, long limitMinor, String productCode, int productVersion,
                       int crossDefaultDpd, List<MasterAgreement.RateCardRow> rateCard, LocalDate date) { }

    record CallOffRequest(String loanId, String vehicleClass, List<String> assetIds, long principalMinor, int term, LocalDate date,
                          String customerAccountId, String payoutAccountId) { }

    record CollectRequest(String reference, long amountMinor, LocalDate date) { }

    @PostMapping
    MasterAgreement sign(Actor actor, @RequestBody SignRequest r) {
        actor.require(ROLE);
        String cur = r.currency() == null || r.currency().isBlank() ? "THB" : r.currency();
        if (r.rateCard() == null) {
            throw new IllegalArgumentException("rateCard is required");
        }
        return masters.sign(r.id(), r.party(), cur, Money.ofMinor(r.limitMinor(), Currency.of(cur)), r.productCode(),
                r.productVersion(), r.crossDefaultDpd(), r.rateCard(), r.date() == null ? LocalDate.now() : r.date());
    }

    @PostMapping("/{id}/call-offs")
    Loan callOff(Actor actor, @PathVariable String id, @RequestBody CallOffRequest r) {
        actor.require(ROLE);
        Loan loan = masters.callOff(id, r.loanId(), r.vehicleClass(), r.assetIds() == null ? List.of() : r.assetIds(),
                money(id, r.principalMinor()), r.term(), r.date() == null ? LocalDate.now() : r.date(), r.customerAccountId(),
                r.payoutAccountId());
        lifecycle.onLoanDisbursed(loan);       // queue its billing and accrual like any loan; keyed tasks, so a retry adds none
        return loan;
    }

    @PostMapping("/{id}/collections")
    Map<String, Object> collect(Actor actor, @PathVariable String id, @RequestBody CollectRequest r) {
        actor.require(ROLE);
        if (r.reference() == null || r.reference().isBlank()) {
            throw new IllegalArgumentException("reference is required");
        }
        masters.collect(id, r.reference(), money(id, r.amountMinor()), r.date() == null ? LocalDate.now() : r.date());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("masterId", id);
        out.put("reference", r.reference());
        out.put("collectedMinor", r.amountMinor());
        return out;
    }

    @PostMapping("/{id}/evaluation")
    MasterAgreement evaluate(Actor actor, @PathVariable String id,
                             @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOf) {
        actor.require(ROLE);
        return masters.evaluate(id, asOf == null ? LocalDate.now() : asOf);
    }

    @PostMapping("/{id}/cure")
    MasterAgreement cure(Actor actor, @PathVariable String id,
                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOf) {
        actor.require(ROLE);
        return masters.cure(id, asOf == null ? LocalDate.now() : asOf);
    }

    @GetMapping("/{id}")
    MasterAgreement one(Actor actor, @PathVariable String id) {
        actor.require(ROLE);
        return masters.find(id).orElseThrow(() -> new IllegalArgumentException("Unknown master agreement " + id));
    }

    @GetMapping("/{id}/schedules")
    List<MasterAgreement.Schedule> schedules(Actor actor, @PathVariable String id) {
        actor.require(ROLE);
        one(actor, id);
        return masters.schedules(id);
    }

    @GetMapping("/{id}/facility")
    Map<String, Object> facility(Actor actor, @PathVariable String id) {
        actor.require(ROLE);
        MasterAgreement m = one(actor, id);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("masterId", id);
        out.put("status", m.status());
        out.put("limitMinor", m.limit());
        out.put("utilisationMinor", masters.utilisation(id).minor());
        out.put("headroomMinor", masters.headroom(id).minor());
        out.put("currency", m.currency());
        return out;
    }

    @GetMapping("/{id}/invoice")
    ConsolidatedInvoice invoice(Actor actor, @PathVariable String id,
                                @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOf) {
        actor.require(ROLE);
        return masters.invoice(id, asOf == null ? LocalDate.now() : asOf);
    }

    @GetMapping("/{id}/co-terminus-term")
    Map<String, Object> coTerminus(Actor actor, @PathVariable String id,
                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        actor.require(ROLE);
        LocalDate on = date == null ? LocalDate.now() : date;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("masterId", id);
        out.put("date", on);
        out.put("termMonths", masters.coTerminusTerm(id, on));
        return out;
    }

    private Money money(String masterId, long minor) {
        MasterAgreement m = masters.find(masterId).orElseThrow(() -> new IllegalArgumentException("Unknown master agreement " + masterId));
        return Money.ofMinor(minor, Currency.of(m.currency()));
    }
}
