package org.fabor.app;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.Map;
import java.util.Optional;
import org.fabor.deposit.DepositService;
import org.fabor.lending.Loan;
import org.fabor.lending.LoanRepo;
import org.fabor.lending.LoanService;
import org.fabor.platform.tenancy.TenantId;
import org.fabor.scheduler.DueQueueStore;
import org.fabor.scheduler.SchedulerWorker;
import org.fabor.scheduler.Task;
import org.fabor.scheduler.TaskHandler;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Turns "a loan exists" and "an account exists" into due work on the scheduler (ADR-0007): one billing task per
 * instalment, a daily accrual task per loan, a monthly interest task per savings account. Handlers are idempotent,
 * so a worker crash or a duplicate delivery cannot double-post.
 */
@Component
class Lifecycle {
    static final ZoneId LOCAL = ZoneId.of("Asia/Bangkok");

    private final TenantId tenant;
    private final DueQueueStore queue;
    private final LoanService loans;
    private final LoanRepo loanRepo;
    private final DepositService deposits;
    private final org.fabor.deposit.DepositRepo depositRepo;
    private final Clock clock;
    private final SchedulerWorker worker;
    private final boolean enabled;

    Lifecycle(TenantId tenant, DueQueueStore queue, LoanService loans, LoanRepo loanRepo, DepositService deposits,
              org.fabor.deposit.DepositRepo depositRepo, Clock clock, FaborProperties props) {
        this.depositRepo = depositRepo;
        this.tenant = tenant;
        this.queue = queue;
        this.loans = loans;
        this.loanRepo = loanRepo;
        this.deposits = deposits;
        this.clock = clock;
        this.enabled = props.schedulerEnabled();
        this.worker = new SchedulerWorker(queue, Map.<String, TaskHandler>of(
                "LOAN_BILL", this::bill, "LOAN_ACCRUE", this::accrue, "DEPOSIT_CAPITALIZE", this::capitalize),
                clock, 50, java.time.Duration.ofMinutes(5), 5, java.time.Duration.ofSeconds(30));
    }

    private Instant startOf(LocalDate d) {
        return d.atStartOfDay(LOCAL).toInstant();
    }

    LocalDate today() {
        return LocalDate.now(clock.withZone(LOCAL));
    }

    void onLoanDisbursed(Loan loan) {
        for (Loan.Instalment i : loan.instalments()) {
            queue.enqueue(new Task(tenant, "bill:" + loan.id() + ":" + i.number(), "LOAN_BILL", loan.id(),
                    startOf(i.dueDate()), loan.id() + "|" + i.number()));
        }
        queue.enqueue(new Task(tenant, "accrue:" + loan.id(), "LOAN_ACCRUE", loan.id(),
                startOf(loan.disbursedOn().plusDays(1)), loan.id()));
    }

    void onAccountOpened(String accountId) {
        queue.enqueue(new Task(tenant, "capitalize:" + accountId, "DEPOSIT_CAPITALIZE", accountId,
                startOf(YearMonth.from(today()).plusMonths(1).atDay(1)), accountId));
    }

    /**
     * Bills one instalment. The schedule can change after the task was queued (prepayment, payment holiday), so the
     * handler reads the live schedule: an instalment that no longer exists is dropped, one that moved is re-queued
     * for its new date, and a billed one is left alone.
     */
    private Optional<Instant> bill(Task t, int attempt) {
        String[] p = t.payload().split("\\|");
        int number = Integer.parseInt(p[1]);
        Loan loan = loanRepo.find(p[0]).orElse(null);
        if (loan == null || number > loan.instalments().size() || loan.status() == Loan.Status.CLOSED) {
            return Optional.empty();
        }
        Loan.Instalment i = loan.instalments().get(number - 1);
        if (i.billed()) {
            return Optional.empty();
        }
        if (today().isBefore(i.dueDate())) {
            return Optional.of(startOf(i.dueDate()));
        }
        loans.bill(p[0], number, today());
        return Optional.empty();
    }

    private Optional<Instant> accrue(Task t, int attempt) {
        Loan l = loans.accrueDaily(t.payload(), today());
        return l.status() == Loan.Status.CLOSED ? Optional.empty() : Optional.of(startOf(today().plusDays(1)));
    }

    private Optional<Instant> capitalize(Task t, int attempt) {
        deposits.capitalize(t.payload(), YearMonth.from(today().minusDays(1)));
        return Optional.of(startOf(YearMonth.from(today()).plusMonths(1).atDay(1)));
    }

    /**
     * Makes sure every active loan and account has its due work queued. Safe to run any time: tasks are keyed, so
     * existing ones are untouched. Covers loans created before the scheduler existed and any lost tasks.
     * @return number of tasks newly queued
     */
    int backfill() {
        int added = 0;
        for (String id : loanRepo.activeIds()) {
            Loan loan = loanRepo.find(id).orElseThrow();
            for (Loan.Instalment i : loan.instalments()) {
                if (!i.billed() && queue.enqueue(new Task(tenant, "bill:" + id + ":" + i.number(), "LOAN_BILL", id,
                        startOf(i.dueDate()), id + "|" + i.number()))) {
                    added++;
                }
            }
            if (queue.enqueue(new Task(tenant, "accrue:" + id, "LOAN_ACCRUE", id, startOf(today().plusDays(1)), id))) {
                added++;
            }
        }
        for (String account : depositRepo.accountIds()) {
            if (queue.enqueue(new Task(tenant, "capitalize:" + account, "DEPOSIT_CAPITALIZE", account,
                    startOf(YearMonth.from(today()).plusMonths(1).atDay(1)), account))) {
                added++;
            }
        }
        return added;
    }

    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    void backfillOnStartup() {
        if (enabled) {
            backfill();
        }
    }

    @Scheduled(fixedDelayString = "${fabor.scheduler-poll-ms:1000}")
    void poll() {
        if (enabled) {
            worker.runOnce();
        }
    }

    /** For tests and operations: run the due queue until empty. */
    int drain() {
        return worker.drain();
    }
}
