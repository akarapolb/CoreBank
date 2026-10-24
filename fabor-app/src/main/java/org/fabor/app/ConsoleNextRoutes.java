package org.fabor.app;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * The React console is a single-page app with its own routes ({@code /console-next/loans/LN-1}). A request for such an
 * address loads the app's page, which then shows the route; requests for files (anything with a dot: scripts, styles,
 * fonts) are served as they are.
 */
@Controller
class ConsoleNextRoutes {
    @GetMapping({"/console-next", "/console-next/", "/console-next/{a:[^.]*}", "/console-next/{a:[^.]*}/{b:[^.]*}",
            "/console-next/{a:[^.]*}/{b:[^.]*}/{c:[^.]*}", "/console-next/{a:[^.]*}/{b:[^.]*}/{c:[^.]*}/{d:[^.]*}"})
    String app() {
        return "forward:/console-next/index.html";
    }
}
