package org.fabor.app;

import java.time.Clock;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import org.fabor.engine.ecl.ExpectedCreditLoss;
import org.fabor.lending.EclRun;
import org.fabor.lending.EclService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The loss-allowance run over HTTP and on a schedule. The run books every loan's allowance for the day (once per loan
 * and day); the preview assesses one loan without booking. Both need the ecl-operator role and the configured model
 * parameters. The bank's significant-increase-in-credit-risk test is not built: no loan is treated as having increased
 * risk unless the preview is asked to assume it.
 */
@RestController
@RequestMapping("/api/v1/ecl")
class EclController {
    private final EclRun run;
    private final EclService ecl;
    private final EclProperties props;
    private final Clock clock;

    EclController(EclRun run, EclService ecl, EclProperties props, Clock clock) {
        this.run = run;
        this.ecl = ecl;
        this.props = props;
        this.clock = clock;
    }

    @PostMapping("/run")
    EclRun.Summary runNow(Actor actor, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOf) {
        actor.require("ecl-operator");
        return runFor(asOf == null ? LocalDate.now(clock) : asOf);
    }

    @GetMapping("/loans/{loanId}")
    Map<String, Object> preview(Actor actor, @PathVariable String loanId,
                                @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOf,
                                @RequestParam(defaultValue = "false") boolean riskIncreased) {
        actor.require("ecl-operator");
        ExpectedCreditLoss.Result r = ecl.assess(loanId, asOf == null ? LocalDate.now(clock) : asOf, riskIncreased, parameters());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("loanId", loanId);
        out.put("stage", r.stage());
        out.put("horizonPd", r.horizonPd().toPlainString());
        out.put("lgd", r.lgd().toPlainString());
        out.put("exposureMinor", r.exposure().minor());
        out.put("allowanceMinor", r.allowance().minor());
        out.put("currency", r.exposure().currency().code());
        return out;
    }

    EclRun.Summary runFor(LocalDate asOf) {
        return run.run(asOf, parameters(), id -> false);
    }

    private ExpectedCreditLoss.Parameters parameters() {
        return props.parameters().orElseThrow(() -> new IllegalStateException(
                "The ECL model parameters are not configured: set fabor.ecl.annual-pd and fabor.ecl.lgd"));
    }

    /** The scheduled daily run, a separate bean so it exists only when switched on. */
    @Component
    static class Daily {
        private final EclController controller;
        private final EclProperties props;
        private final Clock clock;

        Daily(EclController controller, EclProperties props, Clock clock) {
            this.controller = controller;
            this.props = props;
            this.clock = clock;
        }

        @Scheduled(cron = "${fabor.ecl.cron:0 30 1 * * *}")
        void run() {
            if (props.enabled() && props.parameters().isPresent()) {
                controller.runFor(LocalDate.now(clock));
            }
        }
    }
}
