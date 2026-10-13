package org.fabor.app;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.fabor.onboarding.OnboardingService;
import org.fabor.onboarding.Party;
import org.fabor.platform.security.ConsentRegistry;
import org.fabor.platform.tenancy.TenantId;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/customers")
class CustomersController {
    private final OnboardingService onboarding;
    private final ConsentRegistry consents;
    private final TenantId tenant;
    private final Clock clock;
    private final Lifecycle lifecycle;

    CustomersController(OnboardingService onboarding, ConsentRegistry consents, TenantId tenant, Clock clock, Lifecycle lifecycle) {
        this.onboarding = onboarding;
        this.consents = consents;
        this.tenant = tenant;
        this.clock = clock;
        this.lifecycle = lifecycle;
    }

    record ConsentGrant(String purpose, int version, String channel) { }

    record RegisterRequest(String partyId, String fullName, String nationalId, String phone, LocalDate dateOfBirth,
                           String documentRef, List<ConsentGrant> consents) { }

    /** Party as returned to clients: tokens only, never the PII itself. */
    record PartyView(String id, String status, String depositAccountId) { }

    @PostMapping
    PartyView register(Actor actor, @RequestBody RegisterRequest r) {
        actor.require("ops");
        if (r.consents() != null) {
            for (ConsentGrant g : r.consents()) {
                consents.grant(tenant, r.partyId(), g.purpose(), g.version(), clock.instant(), g.channel());
            }
        }
        Party p = onboarding.register(r.partyId(), r.fullName(), r.nationalId(), r.phone(), r.dateOfBirth(), r.documentRef());
        if (p.depositAccountId() != null) {
            lifecycle.onAccountOpened(p.depositAccountId());
        }
        return new PartyView(p.id(), p.status().name(), p.depositAccountId());
    }

    @PostMapping("/{id}/consents/{purpose}/withdraw")
    Map<String, Object> withdraw(Actor actor, @PathVariable String id, @PathVariable String purpose) {
        actor.require("ops");
        consents.withdraw(tenant, id, purpose, clock.instant(), "API");
        return Map.of("party", id, "purpose", purpose, "withdrawn", true);
    }

    @PostMapping("/{id}/release")
    PartyView release(@PathVariable String id, Actor actor) {
        Party p = onboarding.release(id, actor.require("compliance-analyst").name());
        lifecycle.onAccountOpened(p.depositAccountId());
        return new PartyView(p.id(), p.status().name(), p.depositAccountId());
    }
}
