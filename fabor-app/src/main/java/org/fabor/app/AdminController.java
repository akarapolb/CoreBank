package org.fabor.app;

import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
class AdminController {
    private final Lifecycle lifecycle;

    AdminController(Lifecycle lifecycle) {
        this.lifecycle = lifecycle;
    }

    /** Queues any missing due work for active loans and accounts. Idempotent. */
    @PostMapping("/scheduler/backfill")
    Map<String, Object> backfill(Actor actor) {
        actor.require("ops-admin");
        return Map.of("queued", lifecycle.backfill());
    }
}
