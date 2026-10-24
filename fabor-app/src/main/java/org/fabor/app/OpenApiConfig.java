package org.fabor.app;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springdoc.core.utils.SpringDocUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The OpenAPI document of the HTTP API, served at {@code /api/v1/openapi} behind the same sign-in as the API. The
 * console's typed client is generated from it (ADR-0011), so a change that breaks the client fails its build. The caller
 * ({@link Actor}) is resolved from the token, not sent as a parameter, so it is left out of the document.
 */
@Configuration
class OpenApiConfig {
    static {
        SpringDocUtils.getConfig().addRequestWrapperToIgnore(Actor.class);
    }

    @Bean
    OpenAPI faborOpenApi() {
        return new OpenAPI().info(new Info().title("Fabor OS API").version("v1")
                .description("Core banking services: customers, deposits, loans, leases, asset finance, collections, products, ledger."));
    }
}
