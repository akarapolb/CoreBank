package org.fabor.scheduler;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.fabor.platform.tenancy.TenantId;
import org.junit.jupiter.api.Test;

/** Behaviour every {@link DueQueueStore} must have. Subclass and return a fresh, empty store. */
public abstract class DueQueueConformance {
    protected static final TenantId T = new TenantId("bank-a");
    protected static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");

    protected abstract DueQueueStore newStore();

    protected static Task task(String key, Instant due) {
        return new Task(T, key, "ACCRUAL_POST", "ARR-" + key, due, "{}");
    }

    @Test
    void enqueueIsIdempotentPerKey() {
        DueQueueStore s = newStore();
        assertThat(s.enqueue(task("k1", T0))).isTrue();
        assertThat(s.enqueue(task("k1", T0.plusSeconds(5)))).isFalse();
        assertThat(s.enqueue(new Task(new TenantId("bank-b"), "k1", "X", "A", T0, null))).isTrue();
        assertThat(s.pending()).isEqualTo(2);
    }

    @Test
    void claimsOnlyDueTasksOldestFirstUpToLimit() {
        DueQueueStore s = newStore();
        s.enqueue(task("late", T0.plusSeconds(100)));
        s.enqueue(task("b", T0.plusSeconds(10)));
        s.enqueue(task("a", T0.plusSeconds(5)));
        s.enqueue(task("c", T0.plusSeconds(20)));
        List<Claimed> got = s.claim(T0.plusSeconds(30), 2, T0.plusSeconds(90));
        assertThat(got).extracting(c -> c.task().key()).containsExactly("a", "b");
        assertThat(got.get(0).attempt()).isEqualTo(1);
        assertThat(s.claim(T0.plusSeconds(30), 10, T0.plusSeconds(90))).extracting(c -> c.task().key()).containsExactly("c");
    }

    @Test
    void leaseHidesTaskUntilItExpires() {
        DueQueueStore s = newStore();
        s.enqueue(task("k", T0));
        Claimed first = s.claim(T0, 1, T0.plusSeconds(60)).get(0);
        assertThat(s.claim(T0.plusSeconds(30), 1, T0.plusSeconds(90))).isEmpty();
        // worker died: after the lease the task is claimed again, as a new attempt
        Claimed second = s.claim(T0.plusSeconds(61), 1, T0.plusSeconds(120)).get(0);
        assertThat(second.id()).isEqualTo(first.id());
        assertThat(second.attempt()).isEqualTo(2);
        // the dead worker's token no longer works
        assertThat(s.complete(first, Optional.empty())).isFalse();
        assertThat(s.complete(second, Optional.empty())).isTrue();
        assertThat(s.pending()).isZero();
    }

    @Test
    void completeCanReschedule() {
        DueQueueStore s = newStore();
        s.enqueue(task("daily", T0));
        Claimed c = s.claim(T0, 1, T0.plusSeconds(60)).get(0);
        assertThat(s.complete(c, Optional.of(T0.plus(Duration.ofDays(1))))).isTrue();
        assertThat(s.claim(T0.plusSeconds(3600), 1, T0.plusSeconds(7200))).isEmpty();
        Claimed next = s.claim(T0.plus(Duration.ofDays(1)), 1, T0.plus(Duration.ofDays(1)).plusSeconds(60)).get(0);
        assertThat(next.attempt()).isEqualTo(1);
        assertThat(next.task().dueAt()).isEqualTo(T0.plus(Duration.ofDays(1)));
    }

    @Test
    void failRetriesThenParksAsDead() {
        DueQueueStore s = newStore();
        s.enqueue(task("k", T0));
        Claimed c = s.claim(T0, 1, T0.plusSeconds(60)).get(0);
        assertThat(s.fail(c, T0.plusSeconds(10), false, "boom")).isTrue();
        assertThat(s.claim(T0.plusSeconds(5), 1, T0.plusSeconds(60))).isEmpty();
        Claimed again = s.claim(T0.plusSeconds(10), 1, T0.plusSeconds(70)).get(0);
        assertThat(again.attempt()).isEqualTo(2);
        assertThat(s.fail(again, T0.plusSeconds(20), true, "gave up")).isTrue();
        assertThat(s.dead()).extracting(Task::key).containsExactly("k");
        assertThat(s.claim(T0.plusSeconds(1000), 1, T0.plusSeconds(2000))).isEmpty();
        assertThat(s.pending()).isZero();
        assertThat(s.fail(again, T0, false, "stale")).isFalse();
    }

    @Test
    void concurrentWorkersNeverClaimTheSameTaskTwice() throws Exception {
        DueQueueStore s = newStore();
        for (int i = 0; i < 300; i++) {
            s.enqueue(task("k" + i, T0));
        }
        ExecutorService pool = Executors.newFixedThreadPool(8);
        Set<Long> claimed = ConcurrentHashMap.newKeySet();
        AtomicInteger duplicates = new AtomicInteger();
        try {
            List<Future<?>> fs = new ArrayList<>();
            for (int w = 0; w < 8; w++) {
                fs.add(pool.submit(() -> {
                    for (;;) {
                        List<Claimed> got = s.claim(T0, 10, T0.plusSeconds(600));
                        if (got.isEmpty()) {
                            return;
                        }
                        for (Claimed c : got) {
                            if (!claimed.add(c.id())) {
                                duplicates.incrementAndGet();
                            }
                            s.complete(c, Optional.empty());
                        }
                    }
                }));
            }
            for (Future<?> f : fs) {
                f.get(60, TimeUnit.SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }
        assertThat(duplicates.get()).isZero();
        assertThat(claimed).hasSize(300);
        assertThat(s.pending()).isZero();
    }

    @Test
    void workerCatchesUpAfterAnOutageAndHandlesFailures() {
        DueQueueStore s = newStore();
        for (int i = 0; i < 25; i++) {
            s.enqueue(task("k" + i, T0.plusSeconds(i)));
        }
        s.enqueue(new Task(T, "poison", "POISON", "ARR-p", T0, null));
        s.enqueue(new Task(T, "nohandler", "UNKNOWN", "ARR-n", T0, null));
        Set<String> done = new HashSet<>();
        Map<String, TaskHandler> handlers = Map.of(
                "ACCRUAL_POST", (t, a) -> { done.add(t.key()); return Optional.empty(); },
                "POISON", (t, a) -> { throw new IllegalStateException("always fails"); });
        // the system was down for a day; one worker drains everything that became due meanwhile
        Clock later = Clock.fixed(T0.plus(Duration.ofDays(1)), ZoneOffset.UTC);
        SchedulerWorker w = new SchedulerWorker(s, handlers, later, 10, Duration.ofMinutes(5), 1, Duration.ofSeconds(1));
        w.drain();
        assertThat(done).hasSize(25);
        assertThat(s.dead()).extracting(Task::key).containsExactlyInAnyOrder("poison", "nohandler");
        assertThat(s.pending()).isZero();
    }

    @Test
    void workerRetriesWithBackoffBeforeParking() {
        DueQueueStore s = newStore();
        s.enqueue(new Task(T, "flaky", "FLAKY", "ARR-f", T0, null));
        AtomicInteger calls = new AtomicInteger();
        Map<String, TaskHandler> handlers = Map.of("FLAKY", (t, a) -> {
            if (calls.incrementAndGet() < 3) {
                throw new IllegalStateException("not yet");
            }
            return Optional.of(T0.plus(Duration.ofDays(1)));
        });
        MutableClock clock = new MutableClock(T0);
        SchedulerWorker w = new SchedulerWorker(s, handlers, clock, 5, Duration.ofMinutes(5), 5, Duration.ofSeconds(10));
        assertThat(w.runOnce()).isEqualTo(1);       // attempt 1 fails, retry in 10 s
        assertThat(w.runOnce()).isZero();
        clock.set(T0.plusSeconds(10));
        assertThat(w.runOnce()).isEqualTo(1);       // attempt 2 fails, retry in 20 s
        clock.set(T0.plusSeconds(30));
        assertThat(w.runOnce()).isEqualTo(1);       // attempt 3 succeeds and reschedules a day later
        assertThat(calls.get()).isEqualTo(3);
        assertThat(s.dead()).isEmpty();
        assertThat(s.pending()).isEqualTo(1);
    }

    /** Minimal settable clock for worker tests. */
    static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void set(Instant i) {
            now = i;
        }

        @Override
        public java.time.ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
