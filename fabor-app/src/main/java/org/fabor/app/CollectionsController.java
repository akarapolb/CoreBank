package org.fabor.app;

import java.time.LocalDate;
import java.util.List;
import org.fabor.lending.CollectionEvent;
import org.fabor.lending.CollectionsService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Collections over HTTP: the worklist of delinquent loans, and the contacts and promises to pay recorded against one.
 * Needs the collections-agent role. Acting on a recommendation (restructuring, write-off) uses the lending endpoints.
 */
@RestController
@RequestMapping("/api/v1/collections")
class CollectionsController {
    private final CollectionsService collections;

    CollectionsController(CollectionsService collections) {
        this.collections = collections;
    }

    record ContactRequest(String reference, LocalDate date, CollectionEvent.Channel channel, String note) { }

    record PromiseRequest(String reference, LocalDate date, long amount, LocalDate payBy, String note) { }

    @GetMapping("/queue")
    List<CollectionsService.Item> queue(Actor actor, @RequestParam(required = false)
                                        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOf) {
        actor.require("collections-agent");
        return collections.queue(asOf == null ? LocalDate.now() : asOf);
    }

    @GetMapping("/{loanId}")
    List<CollectionEvent> history(Actor actor, @PathVariable String loanId) {
        actor.require("collections-agent");
        return collections.history(loanId);
    }

    @PostMapping("/{loanId}/contacts")
    CollectionEvent contact(Actor actor, @PathVariable String loanId, @RequestBody ContactRequest r) {
        actor.require("collections-agent");
        return collections.recordContact(loanId, required(r.reference()), r.date() == null ? LocalDate.now() : r.date(),
                r.channel() == null ? CollectionEvent.Channel.NONE : r.channel(), r.note());
    }

    @PostMapping("/{loanId}/promises")
    CollectionEvent promise(Actor actor, @PathVariable String loanId, @RequestBody PromiseRequest r) {
        actor.require("collections-agent");
        if (r.payBy() == null) {
            throw new IllegalArgumentException("payBy is required");
        }
        return collections.recordPromise(loanId, required(r.reference()), r.date() == null ? LocalDate.now() : r.date(), r.amount(),
                r.payBy(), r.note());
    }

    private static String required(String reference) {
        if (reference == null || reference.isBlank()) {
            throw new IllegalArgumentException("reference is required");
        }
        return reference;
    }
}
