package org.fabor.lending;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.function.BiFunction;
import org.fabor.engine.product.ProductDefinition;

/**
 * Collections, version 1: a worklist of delinquent loans, a log of contacts and promises to pay, and a recommended next
 * step by how late the loan is. It moves no money: the customer pays through the normal repayment path, and what this
 * service reads is the loan's own state, so there is no second record of arrears to keep in step.
 *
 * <p>Days past due run from the oldest billed, unsettled instalment; the amount overdue is everything billed and unpaid.
 * The recommendation follows the product's delinquency buckets (REMIND, CALL, LETTER, FIELD_VISIT as the loan crosses
 * each) and is overridden by the product's non-accrual and write-off thresholds (RESTRUCTURE_REVIEW, WRITE_OFF_REVIEW).
 * A promise is kept when the amount overdue has fallen by at least the amount promised, broken when its date has passed
 * without that, open until then. Acting on a recommendation (restructuring, write-off) stays a decision of a person.
 */
public final class CollectionsService {
    public enum Action { REMIND, CALL, LETTER, FIELD_VISIT, RESTRUCTURE_REVIEW, WRITE_OFF_REVIEW }

    /**
     * @param bucket        the lower bound of the delinquency bucket the loan is in
     * @param openPromiseBy the date of a promise still waiting to be kept, or null
     */
    public record Item(String loanId, String party, int daysPastDue, long overdue, int bucket, Action recommended,
                       int contacts, LocalDate lastContact, LocalDate openPromiseBy, boolean promiseBroken) { }

    private static final List<Integer> DEFAULT_BUCKETS = List.of(1, 30, 60, 90);

    private final LoanRepo loans;
    private final CollectionRepo repo;
    private final BiFunction<String, Integer, ProductDefinition> products;

    public CollectionsService(LoanRepo loans, CollectionRepo repo, BiFunction<String, Integer, ProductDefinition> products) {
        this.loans = loans;
        this.repo = repo;
        this.products = products;
    }

    /** The worklist: loans with something overdue, the latest first, then the largest amount. */
    public List<Item> queue(LocalDate asOf) {
        List<Item> out = new ArrayList<>();
        for (String id : loans.activeIds()) {
            item(load(id), asOf).ifPresent(out::add);
        }
        out.sort(Comparator.comparingInt(Item::daysPastDue).reversed().thenComparing(Comparator.comparingLong(Item::overdue).reversed())
                .thenComparing(Item::loanId));
        return List.copyOf(out);
    }

    /** One loan's collection status, or empty when nothing is overdue. */
    public java.util.Optional<Item> status(String loanId, LocalDate asOf) {
        return item(load(loanId), asOf);
    }

    /** Records an attempt to reach the customer. Idempotent per reference. */
    public CollectionEvent recordContact(String loanId, String reference, LocalDate date, CollectionEvent.Channel channel,
                                         String note) {
        load(loanId);
        var existing = repo.find(loanId, reference);
        if (existing.isPresent()) {
            return existing.get();
        }
        CollectionEvent e = new CollectionEvent(loanId, reference, date, CollectionEvent.Kind.CONTACT, channel, note, 0, null, 0);
        repo.add(e);
        return e;
    }

    /**
     * Records a promise to pay {@code amount} by {@code payBy}. The loan must have something overdue, and the amount may
     * not exceed it. Idempotent per reference.
     */
    public CollectionEvent recordPromise(String loanId, String reference, LocalDate date, long amount, LocalDate payBy,
                                         String note) {
        Loan loan = load(loanId);
        var existing = repo.find(loanId, reference);
        if (existing.isPresent()) {
            return existing.get();
        }
        long overdue = overdue(loan);
        if (overdue <= 0) {
            throw new IllegalStateException("Loan " + loanId + " has nothing overdue");
        }
        if (amount <= 0 || amount > overdue) {
            throw new IllegalArgumentException("A promise is for more than zero and at most the amount overdue (" + overdue + ")");
        }
        if (!payBy.isAfter(date)) {
            throw new IllegalArgumentException("A promise must fall due after the day it is made");
        }
        CollectionEvent e = new CollectionEvent(loanId, reference, date, CollectionEvent.Kind.PROMISE, CollectionEvent.Channel.NONE,
                note, amount, payBy, overdue);
        repo.add(e);
        return e;
    }

    public List<CollectionEvent> history(String loanId) {
        load(loanId);
        return repo.events(loanId);
    }

    private java.util.Optional<Item> item(Loan loan, LocalDate asOf) {
        long overdue = overdue(loan);
        LocalDate oldest = loan.instalments().stream().filter(i -> i.billed() && !i.settled()).map(Loan.Instalment::dueDate)
                .min(Comparator.naturalOrder()).orElse(null);
        if (overdue <= 0 || oldest == null || !asOf.isAfter(oldest)) {
            return java.util.Optional.empty();
        }
        int dpd = (int) ChronoUnit.DAYS.between(oldest, asOf);
        ProductDefinition p = products.apply(loan.productCode(), loan.productVersion());
        ProductDefinition.Delinquency d = p == null ? null : p.delinquency();
        List<Integer> buckets = d == null || d.buckets() == null || d.buckets().isEmpty() ? DEFAULT_BUCKETS
                : d.buckets().stream().sorted().toList();
        int index = -1;
        for (int i = 0; i < buckets.size(); i++) {
            if (dpd >= buckets.get(i)) {
                index = i;
            }
        }
        int bucket = index < 0 ? 0 : buckets.get(index);
        Action action = switch (Math.max(index, 0)) {
            case 0 -> Action.REMIND;
            case 1 -> Action.CALL;
            case 2 -> Action.LETTER;
            default -> Action.FIELD_VISIT;
        };
        if (d != null && d.writeOffAtDpd() != null && dpd >= d.writeOffAtDpd()) {
            action = Action.WRITE_OFF_REVIEW;
        } else if (d != null && d.nonAccrualAtDpd() != null && dpd >= d.nonAccrualAtDpd()) {
            action = Action.RESTRUCTURE_REVIEW;
        }
        List<CollectionEvent> events = repo.events(loan.id());
        int contacts = 0;
        LocalDate last = null;
        CollectionEvent promise = null;
        for (CollectionEvent e : events) {
            if (e.kind() == CollectionEvent.Kind.CONTACT) {
                contacts++;
                if (last == null || e.date().isAfter(last)) {
                    last = e.date();
                }
            } else {
                promise = e;
            }
        }
        LocalDate openBy = null;
        boolean broken = false;
        if (promise != null && overdue > promise.overdueAtPromise() - promise.promisedAmount()) {
            if (promise.payBy().isBefore(asOf)) {
                broken = true;
            } else {
                openBy = promise.payBy();
            }
        }
        return java.util.Optional.of(new Item(loan.id(), loan.party(), dpd, overdue, bucket, action, contacts, last, openBy, broken));
    }

    private static long overdue(Loan loan) {
        return loan.instalments().stream().filter(Loan.Instalment::billed).mapToLong(Loan.Instalment::outstanding).sum();
    }

    private Loan load(String loanId) {
        return loans.find(loanId).orElseThrow(() -> new IllegalArgumentException("Unknown loan " + loanId));
    }
}
