package org.fabor.ledger.adapter.web;

import static org.assertj.core.api.Assertions.assertThat;

import io.grpc.ManagedChannel;
import io.grpc.Server;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.grpc.inprocess.InProcessChannelBuilder;
import io.grpc.inprocess.InProcessServerBuilder;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.fabor.ledger.api.grpc.Direction;
import org.fabor.ledger.api.grpc.Entry;
import org.fabor.ledger.api.grpc.GetBalanceRequest;
import org.fabor.ledger.api.grpc.LedgerGrpc;
import org.fabor.ledger.api.grpc.PostBatchRequest;
import org.fabor.ledger.application.LedgerService;
import org.fabor.ledger.testkit.InMemoryLedgerStore;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LedgerGrpcServiceTest {
    private Server server;
    private ManagedChannel channel;
    private LedgerGrpc.LedgerBlockingStub stub;

    @BeforeEach
    void start() throws Exception {
        LedgerService svc = new LedgerService(new InMemoryLedgerStore(),
                Clock.fixed(Instant.parse("2026-01-05T00:00:00Z"), ZoneOffset.UTC));
        server = InProcessServerBuilder.forName("t").directExecutor().addService(new LedgerGrpcService(svc)).build().start();
        channel = InProcessChannelBuilder.forName("t").directExecutor().build();
        stub = LedgerGrpc.newBlockingStub(channel);
    }

    @AfterEach
    void stop() {
        channel.shutdownNow();
        server.shutdownNow();
    }

    private static Entry e(String acct, Direction d, long minor) {
        return Entry.newBuilder().setAccount(acct).setBalanceType("SETTLED").setDirection(d).setMinor(minor)
                .setCurrency("THB").build();
    }

    private static PostBatchRequest.Builder req(String id, String key, long credit) {
        return PostBatchRequest.newBuilder().setTenant("bank-a").setBatchId(id).setIdempotencyKey(key)
                .setValueDate("2026-01-01").addEntries(e("cash", Direction.DEBIT, 1000))
                .addEntries(e("cust", Direction.CREDIT, credit));
    }

    @Test
    void postThenReplayThenBalance() {
        var first = stub.postBatch(req("b1", "k1", 1000).build());
        assertThat(first.getReplayed()).isFalse();
        assertThat(stub.postBatch(req("b1", "k1", 1000).build()).getReplayed()).isTrue();
        var bal = stub.getBalance(GetBalanceRequest.newBuilder().setTenant("bank-a").setAccount("cust")
                .setBalanceType("SETTLED").setCurrency("THB").setValueAsOf("2026-01-01").build());
        assertThat(bal.getMinor()).isEqualTo(1000);
    }

    @Test
    void errorsMapToStatusCodes() {
        stub.postBatch(req("b1", "k1", 1000).build());
        assertThat(code(() -> stub.postBatch(req("b2", "k1", 1000).build()))).isEqualTo(Status.Code.ALREADY_EXISTS);
        assertThat(code(() -> stub.postBatch(req("b3", "k3", 999).build()))).isEqualTo(Status.Code.INVALID_ARGUMENT);
        assertThat(code(() -> stub.postBatch(req("b4", "k4", 1000).setReverses("ghost").build())))
                .isEqualTo(Status.Code.FAILED_PRECONDITION);
        assertThat(code(() -> stub.postBatch(req("b5", "k5", 1000).setValueDate("not-a-date").build())))
                .isEqualTo(Status.Code.INVALID_ARGUMENT);
        assertThat(code(() -> stub.postBatch(PostBatchRequest.newBuilder().setTenant("bank-a").setBatchId("b6")
                .setIdempotencyKey("k6").setValueDate("2026-01-01")
                .addEntries(Entry.newBuilder().setAccount("a").setBalanceType("SETTLED").setMinor(1).setCurrency("THB"))
                .addEntries(e("b", Direction.CREDIT, 1)).build()))).isEqualTo(Status.Code.INVALID_ARGUMENT);
        assertThat(code(() -> stub.getBalance(GetBalanceRequest.newBuilder().setTenant("bank-a").setAccount("x")
                .setBalanceType("NOPE").setCurrency("THB").setValueAsOf("2026-01-01").build())))
                .isEqualTo(Status.Code.INVALID_ARGUMENT);
    }

    @Test
    void unexpectedErrorsAreHidden() {
        assertThat(LedgerGrpcService.toStatus(new IllegalStateException("db password leaked")).getDescription())
                .isEqualTo("internal error");
    }

    private static Status.Code code(Runnable r) {
        try {
            r.run();
        } catch (StatusRuntimeException e) {
            return e.getStatus().getCode();
        }
        throw new AssertionError("expected failure");
    }
}
