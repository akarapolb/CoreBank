package org.fabor.lending;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.function.BiFunction;
import org.fabor.engine.ecl.ExpectedCreditLoss;
import org.fabor.engine.interest.Eir;
import org.fabor.engine.interest.Rates;
import org.fabor.engine.product.ProductDefinition;
import org.fabor.engine.schedule.Frequency;
import org.fabor.ledger.application.LedgerService;
import org.fabor.ledger.domain.AccountId;
import org.fabor.ledger.domain.BalanceType;
import org.fabor.ledger.domain.BatchId;
import org.fabor.ledger.domain.Direction;
import org.fabor.ledger.domain.Entry;
import org.fabor.ledger.domain.PostingBatch;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.tenancy.IdempotencyKey;
import org.fabor.platform.tenancy.TenantId;

/**
 * Loan loss allowance (TFRS 9) from the loan's own state: exposure is the principal outstanding plus billed unpaid
 * interest, days past due run from the oldest unpaid billed instalment, and the term left comes from the instalments not
 * yet paid. The allowance sits in one contra-asset account per loan; {@link #book} posts only the change since the last
 * booking, as expense or release. PD and LGD come from the caller's model, and whether credit risk has increased is the
 * caller's own test: both are inputs, not judgements made here.
 */
public final class EclService {
    public static final AccountId ECL_EXPENSE = new AccountId("gl:ecl-expense");

    private final TenantId tenant;
    private final LedgerService ledger;
    private final LoanRepo loans;
    private final BiFunction<String, Integer, ProductDefinition> products;

    public EclService(TenantId tenant, LedgerService ledger, LoanRepo loans,
                      BiFunction<String, Integer, ProductDefinition> products) {
        this.tenant = tenant;
        this.ledger = ledger;
        this.loans = loans;
        this.products = products;
    }

    /** Allowance held against one loan (contra asset: credit balance). */
    public static AccountId allowanceAcct(String loanId) {
        return new AccountId("loan:" + loanId + ":ecl-allowance");
    }

    /** The allowance currently booked against the loan (minor units, in the loan's currency). */
    public long allowanceHeld(String loanId, LocalDate asOf) {
        Loan loan = load(loanId);
        return ledger.balance(tenant, allowanceAcct(loanId), BalanceType.SETTLED, Currency.of(loan.currency()), asOf).minor();
    }

    /** The allowance the loan needs on {@code asOf}. A closed or written-off loan needs none. */
    public ExpectedCreditLoss.Result assess(String loanId, LocalDate asOf, boolean riskIncreased,
                                            ExpectedCreditLoss.Parameters params) {
        Loan loan = load(loanId);
        Currency cur = Currency.of(loan.currency());
        if (loan.status() == Loan.Status.CLOSED || loan.status() == Loan.Status.WRITTEN_OFF) {
            return new ExpectedCreditLoss.Result(ExpectedCreditLoss.Stage.STAGE_1, BigDecimal.ZERO, params.lgd(),
                    Money.zero(cur), Money.zero(cur));
        }
        ProductDefinition p = products.apply(loan.productCode(), loan.productVersion());
        if (p == null) {
            throw new IllegalStateException("Product " + loan.productCode() + " v" + loan.productVersion() + " is not available");
        }
        long exposure = 0;
        int open = 0;
        LocalDate oldest = null;
        for (Loan.Instalment i : loan.instalments()) {
            exposure += i.principalOutstanding() + (i.billed() ? i.interestOutstanding() : 0);
            if (i.principalOutstanding() > 0) {
                open++;
            }
            if (i.billed() && !i.settled() && oldest == null) {
                oldest = i.dueDate();
            }
        }
        int dpd = oldest == null || !asOf.isAfter(oldest) ? 0 : (int) ChronoUnit.DAYS.between(oldest, asOf);
        Frequency f = Frequency.valueOf(p.schedule().frequency());
        int months = Math.max(1, (int) Math.ceil(12.0 * open / f.perYear()));
        boolean impaired = loan.status() == Loan.Status.NON_ACCRUAL;
        ExpectedCreditLoss.Exposure e = new ExpectedCreditLoss.Exposure(Money.ofMinor(exposure, cur), dpd, impaired,
                riskIncreased, months, annualEir(loan, p, f));
        return ExpectedCreditLoss.compute(e, params);
    }

    /**
     * Brings the loan's allowance to what {@link #assess} says by posting the difference (expense when it grows, release
     * when it falls). Idempotent per loan and date: a second call on the same day books nothing more.
     */
    public ExpectedCreditLoss.Result book(String loanId, LocalDate asOf, boolean riskIncreased,
                                          ExpectedCreditLoss.Parameters params) {
        ExpectedCreditLoss.Result r = assess(loanId, asOf, riskIncreased, params);
        String ref = loanId + ":ecl-" + asOf;
        if (ledger.find(tenant, new BatchId(ref)).isPresent()) {
            return r;
        }
        Currency cur = r.allowance().currency();
        long held = ledger.balance(tenant, allowanceAcct(loanId), BalanceType.SETTLED, cur, asOf).minor();
        long change = r.allowance().minor() - held;
        if (change != 0) {
            List<Entry> entries = new ArrayList<>();
            Money amount = Money.ofMinor(Math.abs(change), cur);
            entries.add(new Entry(change > 0 ? ECL_EXPENSE : allowanceAcct(loanId), BalanceType.SETTLED, Direction.DEBIT, amount));
            entries.add(new Entry(change > 0 ? allowanceAcct(loanId) : ECL_EXPENSE, BalanceType.SETTLED, Direction.CREDIT, amount));
            ledger.post(PostingBatch.of(tenant, new BatchId(ref), new IdempotencyKey(ref), asOf, entries));
        }
        return r;
    }

    /** Effective annual rate used to discount: the nominal rate compounded, or for a flat quote the implied rate. */
    private static BigDecimal annualEir(Loan loan, ProductDefinition p, Frequency f) {
        BigDecimal rate = loan.rateOverride() != null ? loan.rateOverride() : p.pricing().rate();
        if (rate == null) {
            return BigDecimal.ZERO;
        }
        if ("ANNUITY_FROM_FLAT".equals(p.schedule().method())) {
            long principal = loan.instalments().stream().mapToLong(Loan.Instalment::principalOutstanding).sum();
            List<Long> pays = loan.instalments().stream().filter(i -> i.principalOutstanding() > 0)
                    .map(i -> i.principalOutstanding() + i.interestDue() - i.interestPaid()).toList();
            if (principal <= 0 || pays.isEmpty()) {
                return BigDecimal.ZERO;
            }
            return Rates.effectiveAnnual(Eir.periodicRate(principal, pays), f.perYear());
        }
        return Rates.effectiveAnnual(Rates.periodic(rate, f.perYear()), f.perYear());
    }

    private Loan load(String loanId) {
        return loans.find(loanId).orElseThrow(() -> new IllegalArgumentException("Unknown loan " + loanId));
    }
}
