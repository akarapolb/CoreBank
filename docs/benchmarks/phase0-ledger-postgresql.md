# Phase 0 ledger benchmark: PostgreSQL, single node

Status: **indicative, not the Phase 0 exit gate.** The gate is 10,000 batches/s at p99 < 50 ms on a dedicated performance environment ([docs/11](../11-global-scale-and-benchmark.md)). That environment does not exist yet. These numbers come from a development container and exist to compare design options and to catch regressions.

## Setup

| Item | Value |
|---|---|
| Machine | 4 vCPU Intel Xeon @ 2.1 GHz, 15 GB RAM, shared by PostgreSQL **and** the load generator |
| Database | PostgreSQL 16.15, stock configuration (`shared_buffers` 128 MB, `fsync` on, `synchronous_commit` on) |
| Load | `ledger-perf` `LedgerBench`: 32 closed-loop threads, 15 s per run, 100,000 accounts, uniform random two-leg transfers |
| Per batch | batch row, entry rows, outbox row, and balance upserts, in one transaction; each caller returns after commit |
| Hot case | every batch also credits one shared `fee` account (a third leg) |

Reproduce: `java -cp <ledger-perf classpath> org.fabor.ledger.perf.LedgerBench <jdbc-url> <user> <password> <threads> <seconds> <accounts> <hot> <plain|group> [stripes]`.

## Results

Uniform load, three runs each:

| Mode | Throughput (batches/s) | p50 | p99 |
|---|---|---|---|
| Plain (one transaction per batch) | 4,207 · 4,248 · 4,285 | 6.2 ms | 25.8–27.9 ms |
| Group commit | 4,891 · 5,141 · 4,985 | 4.9–5.1 ms | 24.1–26.9 ms |

Hot account (single run each):

| Mode | Throughput | p50 | p99 |
|---|---|---|---|
| Plain, no striping | 1,045 | 18.0 ms | 165.0 ms |
| Plain, 16 stripes | 3,370 | 8.2 ms | 33.6 ms |
| Group commit, no striping | 4,889 | 5.2 ms | 28.6 ms |
| Group commit, 16 stripes | 4,759 | 5.3 ms | 27.6 ms |

## What this shows

- **Hot accounts are the first wall.** One shared account caps plain posting near 1,000/s because every batch queues on one row lock. Striping the balance over 16 rows gives about 3.2×.
- **Group commit removes most of the hot-account problem on its own.** A group updates each balance once, aggregated over all its batches, so the hot row is touched once per group instead of once per batch. With group commit, striping adds nothing at this scale.
- **Group commit gives about +17% on uniform load here**, less than the design expects, because this container's log flush is cheap. Expect a larger gain on network storage.
- p99 is inside the 50 ms budget at about 5,000/s on this box. Whether 10,000/s fits is open: the CPU is shared with the load generator, and PostgreSQL is untuned.

## Not measured yet

- The 10,000/s gate on a dedicated environment, and tuned PostgreSQL (WAL, checkpoints, connection pool sizing).
- Oracle baseline (needs an Oracle instance; the store and conformance run are wired in CI but unproven).
- Mixed read/write load, multi-shard scaling, and failure behaviour (that is sprint S5).
- Gatling scenarios: the Gatling gRPC extension is not published to Maven Central, so the in-repo harness is used until a REST adapter exists or the extension is vendored.
