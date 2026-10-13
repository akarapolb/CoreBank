package org.fabor.ledger.adapter.web;

import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.fabor.ledger.api.grpc.GetBalanceRequest;
import org.fabor.ledger.api.grpc.GetBalanceResponse;
import org.fabor.ledger.api.grpc.LedgerGrpc;
import org.fabor.ledger.api.grpc.PostBatchRequest;
import org.fabor.ledger.api.grpc.PostBatchResponse;
import org.fabor.ledger.application.IdempotencyConflictException;
import org.fabor.ledger.application.InvalidReversalException;
import org.fabor.ledger.application.LedgerService;
import org.fabor.ledger.application.LedgerStore;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.ledger.domain.Direction;
import org.fabor.ledger.domain.Entry;
import org.fabor.ledger.domain.PostingBatch;
import org.fabor.ledger.domain.UnbalancedBatchException;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.IdempotencyKey;
import org.fabor.platform.tenancy.TenantId;

/** gRPC endpoint of the ledger. Translates the wire contract to domain objects and errors to status codes. */
public final class LedgerGrpcService extends LedgerGrpc.LedgerImplBase {
    private final LedgerService ledger;

    public LedgerGrpcService(LedgerService ledger) {
        this.ledger = ledger;
    }

    @Override
    public void postBatch(PostBatchRequest req, StreamObserver<PostBatchResponse> out) {
        try {
            List<Entry> entries = new ArrayList<>();
            for (org.fabor.ledger.api.grpc.Entry e : req.getEntriesList()) {
                entries.add(new Entry(new AccountId(e.getAccount()), BalanceType.valueOf(e.getBalanceType()),
                        direction(e.getDirection()), Money.ofMinor(e.getMinor(), Currency.of(e.getCurrency()))));
            }
            Optional<BatchId> reverses = req.getReverses().isEmpty() ? Optional.empty()
                    : Optional.of(new BatchId(req.getReverses()));
            PostingBatch batch = new PostingBatch(new TenantId(req.getTenant()), new BatchId(req.getBatchId()),
                    new IdempotencyKey(req.getIdempotencyKey()), LocalDate.parse(req.getValueDate()), entries, reverses);
            LedgerStore.PostResult r = ledger.post(batch);
            out.onNext(PostBatchResponse.newBuilder().setBatchId(batch.id().value())
                    .setRecordedAt(r.stored().recordedAt().toString()).setReplayed(r.replayed()).build());
            out.onCompleted();
        } catch (RuntimeException e) {
            out.onError(toStatus(e).asRuntimeException());
        }
    }

    @Override
    public void getBalance(GetBalanceRequest req, StreamObserver<GetBalanceResponse> out) {
        try {
            Currency cur = Currency.of(req.getCurrency());
            Money m = ledger.balance(new TenantId(req.getTenant()), new AccountId(req.getAccount()),
                    BalanceType.valueOf(req.getBalanceType()), cur, LocalDate.parse(req.getValueAsOf()));
            out.onNext(GetBalanceResponse.newBuilder().setMinor(m.minor()).setCurrency(cur.code()).build());
            out.onCompleted();
        } catch (RuntimeException e) {
            out.onError(toStatus(e).asRuntimeException());
        }
    }

    private static Direction direction(org.fabor.ledger.api.grpc.Direction d) {
        return switch (d) {
            case DEBIT -> Direction.DEBIT;
            case CREDIT -> Direction.CREDIT;
            default -> throw new IllegalArgumentException("direction is required");
        };
    }

    static Status toStatus(RuntimeException e) {
        if (e instanceof IdempotencyConflictException) {
            return Status.ALREADY_EXISTS.withDescription(e.getMessage());
        }
        if (e instanceof InvalidReversalException) {
            return Status.FAILED_PRECONDITION.withDescription(e.getMessage());
        }
        if (e instanceof UnbalancedBatchException || e instanceof IllegalArgumentException
                || e instanceof DateTimeParseException) {
            return Status.INVALID_ARGUMENT.withDescription(e.getMessage());
        }
        return Status.INTERNAL.withDescription("internal error");
    }
}
