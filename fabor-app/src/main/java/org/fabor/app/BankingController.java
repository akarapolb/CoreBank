package org.fabor.app;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.fabor.decisioning.CreditDecision;
import org.fabor.deposit.DepositService;
import org.fabor.lending.Loan;
import org.fabor.lending.LoanRepo;
import org.fabor.lending.LoanService;
import org.fabor.onboarding.OriginationService;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Deposits and loans. Amounts are integer minor units (satang). */
@RestController
@RequestMapping("/api/v1")
class BankingController {
    private final DepositService deposits;
    private final OriginationService origination;
    private final LoanService loans;
    private final LoanRepo loanRepo;
    private final Lifecycle lifecycle;

    BankingController(DepositService deposits, OriginationService origination, LoanService loans, LoanRepo loanRepo,
                      Lifecycle lifecycle) {
        this.deposits = deposits;
        this.origination = origination;
        this.loans = loans;
        this.loanRepo = loanRepo;
        this.lifecycle = lifecycle;
    }

    record MoneyMove(String reference, long amountMinor, String currency, LocalDate valueDate) { }

    record BalanceView(String account, long minor, String currency, LocalDate asOf) { }

    @PostMapping("/accounts/{id}/deposits")
    Map<String, Object> deposit(Actor actor, @PathVariable String id, @RequestBody MoneyMove m) {
        actor.require("ops");
        deposits.deposit(id, m.reference(), Money.ofMinor(m.amountMinor(), Currency.of(m.currency())), m.valueDate());
        return Map.of("account", id, "reference", m.reference(), "status", "posted");
    }

    @PostMapping("/accounts/{id}/withdrawals")
    Map<String, Object> withdraw(Actor actor, @PathVariable String id, @RequestBody MoneyMove m) {
        actor.require("ops");
        deposits.withdraw(id, m.reference(), Money.ofMinor(m.amountMinor(), Currency.of(m.currency())), m.valueDate());
        return Map.of("account", id, "reference", m.reference(), "status", "posted");
    }

    @GetMapping("/accounts/{id}/balance")
    BalanceView balance(@PathVariable String id, @RequestParam LocalDate asOf) {
        Money b = deposits.balance(id, asOf);
        return new BalanceView(id, b.minor(), b.currency().code(), asOf);
    }

    record ApplicationRequest(String applicationId, String partyId, String productCode, int productVersion, long amountMinor,
                              int termMonths, long monthlyInstalmentMinor, long monthlyIncomeMinor, long existingDebtMinor,
                              int monthsAtEmployer, LocalDate asOf, String currency) { }

    record ReasonView(String code, String text) { }

    record DecisionView(String decision, int score, List<ReasonView> reasons, String loanId) { }

    @PostMapping("/loans/applications")
    DecisionView apply(Actor actor, @RequestBody ApplicationRequest r) {
        actor.require("ops");
        var out = origination.apply(new OriginationService.Application(r.applicationId(), r.partyId(), r.productCode(),
                r.productVersion(), r.amountMinor(), r.termMonths(), r.monthlyInstalmentMinor(), r.monthlyIncomeMinor(),
                r.existingDebtMinor(), r.monthsAtEmployer(), r.asOf()), Currency.of(r.currency()));
        if (out.loan() != null) {
            lifecycle.onLoanDisbursed(out.loan());
        }
        return new DecisionView(out.decision().name(), out.score(),
                out.reasons().stream().map((CreditDecision.Reason x) -> new ReasonView(x.code(), x.text())).toList(),
                out.loan() == null ? null : out.loan().id());
    }

    record LoanView(String id, String status, long principal, int instalments, int paidInstalments, int dpd) { }

    @GetMapping("/loans/{id}")
    LoanView loan(@PathVariable String id, @RequestParam LocalDate asOf) {
        Loan l = loanRepo.find(id).orElseThrow(() -> new IllegalArgumentException("No such loan " + id));
        return new LoanView(l.id(), l.status().name(), l.principal(), l.instalments().size(),
                (int) l.instalments().stream().filter(Loan.Instalment::settled).count(), loans.dpd(id, asOf));
    }

    @PostMapping("/loans/{id}/repayments")
    LoanView repay(Actor actor, @PathVariable String id, @RequestBody MoneyMove m) {
        actor.require("ops");
        loans.repay(id, m.reference(), Money.ofMinor(m.amountMinor(), Currency.of(m.currency())), m.valueDate());
        return loan(id, m.valueDate());
    }

    @PostMapping("/loans/{id}/settlement")
    LoanView settle(Actor actor, @PathVariable String id, @RequestBody MoneyMove m) {
        actor.require("ops");
        loans.settle(id, m.reference(), m.valueDate());
        return loan(id, m.valueDate());
    }

    record RestructureRequest(String reference, java.math.BigDecimal newRate, int newTerm, LocalDate date) { }

    record WriteOffRequest(String reference, LocalDate date, boolean override) { }

    /** Restructuring needs a credit officer; the result is a new schedule at a rate no higher than before. */
    @PostMapping("/loans/{id}/restructure")
    LoanView restructure(Actor actor, @PathVariable String id, @RequestBody RestructureRequest r) {
        actor.require("credit-officer");
        loans.restructure(id, r.reference(), r.newRate(), r.newTerm(), r.date());
        return loan(id, r.date());
    }

    /** Writing a loan off before its write-off day count needs a separate, stronger role. */
    @PostMapping("/loans/{id}/write-off")
    LoanView writeOff(Actor actor, @PathVariable String id, @RequestBody WriteOffRequest r) {
        actor.require("write-off-approver");
        loans.writeOff(id, r.reference(), r.date(), r.override() && actor.has("write-off-exception"));
        return loan(id, r.date());
    }

    @PostMapping("/loans/{id}/recoveries")
    Map<String, Object> recover(Actor actor, @PathVariable String id, @RequestBody MoneyMove m) {
        actor.require("ops");
        Money owed = loans.recover(id, m.reference(), Money.ofMinor(m.amountMinor(), Currency.of(m.currency())), m.valueDate());
        return Map.of("loan", id, "stillOwedMinor", owed.minor());
    }
}
