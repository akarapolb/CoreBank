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
 * Placeholder authentication for /api/**: a shared bearer token, compared in constant time. The caller's identity
 * for maker-checker comes from {@code X-Actor} and is only as trustworthy as this token, so this is for the
 * pilot behind a gateway; production uses OIDC (Keycloak) and takes the actor from the verified subject.
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
        chain.doFilter(req, res);
    }
}
