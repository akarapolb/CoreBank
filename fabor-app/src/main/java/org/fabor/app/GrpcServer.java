package org.fabor.app;

import io.grpc.Metadata;
import io.grpc.Server;
import io.grpc.ServerCall;
import io.grpc.ServerCallHandler;
import io.grpc.ServerInterceptor;
import io.grpc.ServerInterceptors;
import io.grpc.Status;
import io.grpc.netty.shaded.io.grpc.netty.NettyServerBuilder;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.TimeUnit;
import org.fabor.ledger.adapter.web.LedgerGrpcService;
import org.springframework.context.SmartLifecycle;

/** Runs the ledger gRPC endpoint next to the HTTP API, with the same authentication mode. */
final class GrpcServer implements SmartLifecycle {
    private static final Metadata.Key<String> AUTH = Metadata.Key.of("authorization", Metadata.ASCII_STRING_MARSHALLER);

    private final int port;
    private final LedgerGrpcService service;
    private final byte[] expected;
    private Server server;

    private final org.springframework.security.oauth2.jwt.JwtDecoder jwt;

    /** Exactly one of {@code token} (development) or {@code jwt} (OIDC, role {@code ledger-client}) authenticates callers. */
    GrpcServer(int port, LedgerGrpcService service, String token, org.springframework.security.oauth2.jwt.JwtDecoder jwt) {
        this.port = port;
        this.service = service;
        this.expected = token == null ? null : ("Bearer " + token).getBytes(StandardCharsets.UTF_8);
        this.jwt = jwt;
    }

    private boolean authorised(String header) {
        if (header == null) {
            return false;
        }
        if (expected != null) {
            return MessageDigest.isEqual(header.getBytes(StandardCharsets.UTF_8), expected);
        }
        if (!header.startsWith("Bearer ")) {
            return false;
        }
        try {
            return ActorResolver.rolesOf(jwt.decode(header.substring(7))).contains("ledger-client");
        } catch (RuntimeException e) {
            return false;
        }
    }

    @Override
    public void start() {
        if (port <= 0) {
            return;
        }
        ServerInterceptor auth = new ServerInterceptor() {
            @Override
            public <Q, R> ServerCall.Listener<Q> interceptCall(ServerCall<Q, R> call, Metadata headers,
                                                              ServerCallHandler<Q, R> next) {
                if (!authorised(headers.get(AUTH))) {
                    call.close(Status.UNAUTHENTICATED.withDescription("bearer token required"), new Metadata());
                    return new ServerCall.Listener<>() { };
                }
                return next.startCall(call, headers);
            }
        };
        try {
            server = NettyServerBuilder.forPort(port).addService(ServerInterceptors.intercept(service, auth)).build().start();
        } catch (IOException e) {
            throw new IllegalStateException("Cannot start gRPC on port " + port, e);
        }
    }

    int boundPort() {
        return server == null ? -1 : server.getPort();
    }

    @Override
    public void stop() {
        if (server != null) {
            server.shutdown();
            try {
                server.awaitTermination(5, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    @Override
    public boolean isRunning() {
        return server != null && !server.isShutdown();
    }
}
