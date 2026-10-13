package org.fabor.agent;

import java.time.Instant;

/** Receives one record per tool call, allowed or not. Production binds this to the audit store. */
public interface AuditSink {
    record Entry(Instant at, String agentId, String onBehalfOf, String tenant, String tool, String arguments,
                 String outcome) { }

    void record(Entry entry);
}
