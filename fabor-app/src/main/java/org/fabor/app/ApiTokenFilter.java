package org.fabor.app;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Development-only authentication for /api/** ({@code fabor.auth-mode=token}): a shared bearer token, compared in
 * constant time, with the caller's name taken from {@code X-Actor} and every role granted. Production uses OIDC.
 */
final class ApiTokenFilter extends OncePerRequestFilter {
    private final byte[] expected;

    ApiTokenFilter(String token) {
        this.expected = ("Bearer " + token).getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String header = req.getHeader("Authorization");
        boolean ok = header != null && MessageDigest.isEqual(header.getBytes(StandardCharsets.UTF_8), expected);
        String actor = req.getHeader("X-Actor");
        if (!ok) {
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            res.setContentType("application/json");
            res.getWriter().write("{\"error\":\"unauthorized\"}");
            return;
        }
        if (actor == null || actor.isBlank() || actor.length() > 100) {
            res.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            res.setContentType("application/json");
            res.getWriter().write("{\"error\":\"X-Actor header is required\"}");
            return;
        }
        req.setAttribute(ActorResolver.ATTRIBUTE, new Actor(actor, java.util.Set.of(Actor.ANY), req.getHeader("X-Party")));
        chain.doFilter(req, res);
    }
}
