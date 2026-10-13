package org.fabor.app;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Tells the console how to sign in. Public by design: it contains no secrets, only endpoint addresses. */
@RestController
class ConsoleConfigController {
    private final FaborProperties props;
    private final ConsoleProperties console;

    ConsoleConfigController(FaborProperties props, ConsoleProperties console) {
        this.props = props;
        this.console = console;
    }

    @GetMapping("/console/config.json")
    Map<String, Object> config() {
        Map<String, Object> m = new LinkedHashMap<>();
        if (props.tokenMode() || !console.configured()) {
            m.put("mode", "token");
            return m;
        }
        m.put("mode", "oidc");
        m.put("clientId", console.clientId());
        m.put("authorizationEndpoint", console.authorizationEndpoint());
        m.put("tokenEndpoint", console.tokenEndpoint());
        m.put("scope", console.scope());
        return m;
    }
}
