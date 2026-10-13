package org.fabor.app;

import java.util.Map;
import org.fabor.ledger.application.IdempotencyConflictException;
import org.fabor.ledger.application.InsufficientFundsException;
import org.fabor.ledger.application.InvalidReversalException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Maps domain failures to stable HTTP statuses. Unexpected errors are logged and never leak details. */
@RestControllerAdvice
class ApiErrors {
    private static final Logger LOG = LoggerFactory.getLogger(ApiErrors.class);

    @ExceptionHandler(InsufficientFundsException.class)
    ResponseEntity<Map<String, String>> funds(InsufficientFundsException e) {
        return body(HttpStatus.UNPROCESSABLE_ENTITY, "insufficient_funds", e.getMessage());
    }

    @ExceptionHandler({IdempotencyConflictException.class, InvalidReversalException.class, IllegalStateException.class})
    ResponseEntity<Map<String, String>> conflict(RuntimeException e) {
        if (e.getCause() != null && !(e instanceof IdempotencyConflictException) && !(e instanceof InvalidReversalException)) {
            LOG.error("State error", e);
            return body(HttpStatus.INTERNAL_SERVER_ERROR, "internal_error", "Internal error");
        }
        return body(HttpStatus.CONFLICT, "conflict", e.getMessage());
    }

    @ExceptionHandler({IllegalArgumentException.class, org.springframework.http.converter.HttpMessageNotReadableException.class})
    ResponseEntity<Map<String, String>> bad(Exception e) {
        return body(HttpStatus.BAD_REQUEST, "bad_request", e instanceof IllegalArgumentException ? e.getMessage() : "Malformed request");
    }

    @ExceptionHandler(SecurityException.class)
    ResponseEntity<Map<String, String>> forbidden(SecurityException e) {
        return body(HttpStatus.FORBIDDEN, "forbidden", e.getMessage());
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, String>> other(Exception e) {
        LOG.error("Unhandled error", e);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "internal_error", "Internal error");
    }

    private static ResponseEntity<Map<String, String>> body(HttpStatus s, String code, String message) {
        return ResponseEntity.status(s).body(Map.of("error", code, "message", String.valueOf(message)));
    }
}
