package org.fabor.app;

import jakarta.servlet.http.HttpServletRequest;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.core.MethodParameter;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/** Lets controllers take an {@link Actor} parameter. */
final class ActorResolver implements HandlerMethodArgumentResolver {
    static final String ATTRIBUTE = "fabor.actor";

    @Override
    public boolean supportsParameter(MethodParameter p) {
        return p.getParameterType() == Actor.class;
    }

    @Override
    public Object resolveArgument(MethodParameter p, ModelAndViewContainer m, NativeWebRequest request, WebDataBinderFactory f) {
        HttpServletRequest http = request.getNativeRequest(HttpServletRequest.class);
        Object fromFilter = http == null ? null : http.getAttribute(ATTRIBUTE);
        if (fromFilter instanceof Actor a) {
            return a;
        }
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken jwt) {
            return fromJwt(jwt.getToken());
        }
        throw new SecurityException("Not authenticated");
    }

    static Actor fromJwt(Jwt jwt) {
        String name = jwt.getClaimAsString("preferred_username");
        if (name == null || name.isBlank()) {
            name = jwt.getSubject();
        }
        return new Actor(name, rolesOf(jwt));
    }

    @SuppressWarnings("unchecked")
    static Set<String> rolesOf(Jwt jwt) {
        Set<String> roles = new HashSet<>();
        Object realm = jwt.getClaim("realm_access");
        if (realm instanceof Map<?, ?> map && map.get("roles") instanceof List<?> list) {
            list.forEach(r -> roles.add(String.valueOf(r)));
        }
        return roles;
    }
}
