package org.fabor.agent;

/** A failure whose message may be shown to the agent. Anything else becomes a generic error. */
public class ToolException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public ToolException(String message) {
        super(message);
    }
}
