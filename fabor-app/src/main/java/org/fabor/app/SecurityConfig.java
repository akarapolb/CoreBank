package org.fabor.app;

import java.util.List;
import org.springframework.boot.actuate.autoconfigure.security.servlet.EndpointRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * HTTP security. OIDC mode: every /api request needs a valid JWT (signature, issuer and expiry are checked by Spring
 * against the JWKS configured in spring.security.oauth2.resourceserver.jwt.*), and roles are enforced per operation.
 * Token mode: the development filter does the authentication and Spring lets requests through to it.
 */
@Configuration
class SecurityConfig implements WebMvcConfigurer {

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(new ActorResolver());
    }

    /** Health, info and metrics live on the management port, which is not exposed outside the cluster. */
    @Bean
    @Order(1)
    SecurityFilterChain management(HttpSecurity http) throws Exception {
        http.securityMatcher(EndpointRequest.toAnyEndpoint()).authorizeHttpRequests(a -> a.anyRequest().permitAll())
                .csrf(c -> c.disable());
        return http.build();
    }

    /**
     * The staff console is the design prototype shipped as-is, and the customer app shares its typefaces: it loads its typefaces from Google Fonts and styles
     * elements with style attributes. Scripts stay restricted to this origin, and the API chain below keeps the strict policy.
     */
    @Bean
    @Order(2)
    SecurityFilterChain consoleUi(HttpSecurity http, ConsoleProperties console) throws Exception {
        http.securityMatcher("/console/**", "/app/**").authorizeHttpRequests(a -> a.anyRequest().permitAll())
                .csrf(c -> c.disable()).sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(h -> h.contentSecurityPolicy(c -> c.policyDirectives(
                        "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; style-src-attr 'unsafe-inline';"
                                + " font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' " + console.tokenOrigin()
                                + "; frame-ancestors 'none'; base-uri 'none'")));
        return http.build();
    }

    /**
     * The React console ({@code web/apps/console}, ADR-0011). It self-hosts its fonts and uses no inline styles or
     * scripts, so its policy is stricter than the prototype's: everything from this origin only.
     */
    @Bean
    @Order(3)
    SecurityFilterChain consoleNext(HttpSecurity http, ConsoleProperties console) throws Exception {
        http.securityMatcher("/console-next", "/console-next/**").authorizeHttpRequests(a -> a.anyRequest().permitAll())
                .csrf(c -> c.disable()).sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(h -> h.contentSecurityPolicy(c -> c.policyDirectives(
                        "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' "
                                + console.tokenOrigin() + "; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")));
        return http.build();
    }

    @Bean
    @Order(4)
    SecurityFilterChain api(HttpSecurity http, FaborProperties props, ConsoleProperties console) throws Exception {
        http.csrf(c -> c.disable()).sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(h -> h.contentSecurityPolicy(c -> c.policyDirectives(
                        "default-src 'self'; img-src 'self' data:; connect-src 'self' " + console.tokenOrigin()
                                + "; frame-ancestors 'none'; base-uri 'none'")));
        if (props.tokenMode()) {
            http.authorizeHttpRequests(a -> a.anyRequest().permitAll());
        } else {
            http.authorizeHttpRequests(a -> a.requestMatchers(HttpMethod.OPTIONS, "/**").denyAll()
                    .requestMatchers("/console/**", "/app/**").permitAll().anyRequest().authenticated())
                    .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()));
        }
        return http.build();
    }
}
