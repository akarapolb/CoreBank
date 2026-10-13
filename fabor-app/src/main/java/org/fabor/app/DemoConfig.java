package org.fabor.app;

import java.util.Optional;
import org.fabor.onboarding.Ports;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;

/**
 * Local demonstration only (profile {@code demo}): an eKYC provider that passes everyone and a bureau that returns a
 * good score, so the whole journey can be shown without external services. It refuses to start outside the development
 * token mode, so it cannot be switched on by accident in an environment with real sign-in.
 */
@Configuration
@Profile("demo")
class DemoConfig {
    DemoConfig(FaborProperties props) {
        if (!props.tokenMode()) {
            throw new IllegalStateException("The demo profile is only allowed with fabor.auth-mode=token");
        }
    }

    @Bean
    @Primary
    Ports.EkycProvider demoEkyc() {
        return (id, name, dob, ref) -> new Ports.EkycResult(true, 0.99, "demo");
    }

    @Bean
    @Primary
    Ports.CreditBureau demoBureau() {
        return id -> Optional.of(new Ports.BureauReport(740, 0));
    }
}
