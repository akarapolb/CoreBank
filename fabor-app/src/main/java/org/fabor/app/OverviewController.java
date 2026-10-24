package org.fabor.app;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import org.fabor.assets.AssetService;
import org.fabor.deposit.DepositRepo;
import org.fabor.deposit.DepositService;
import org.fabor.lending.EclService;
import org.fabor.lending.Loan;
import org.fabor.lending.LoanRepo;
import org.fabor.lending.LoanService;
import org.fabor.platform.money.Money;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The bank's state at a glance for the console Overview: deposits, loans, the share of the loan book that is
 * non-performing, what is overdue, assets with no cover and the loss allowance held. Everything is read from the live
 * services on each call, so it is exact but walks every account and loan: fine for a first version, and the first thing
 * to replace with a maintained summary when the book is large. Amounts are Thai baht in minor units; accounts and loans
 * in other currencies are counted but not added in.
 *
 * <p>Non-performing means 90 or more days past due, or already non-accrual. Not measured here: posting volume and
 * latency, and the reconciliation of the sub-ledgers against the GL.
 */
@RestController
@RequestMapping("/api/v1")
class OverviewController {
    private final DepositRepo depositRepo;
    private final DepositService deposits;
    private final LoanRepo loanRepo;
    private final LoanService loans;
    private final EclService ecl;
    private final AssetService assets;

    OverviewController(DepositRepo depositRepo, DepositService deposits, LoanRepo loanRepo, LoanService loans, EclService ecl,
                       AssetService assets) {
        this.depositRepo = depositRepo;
        this.deposits = deposits;
        this.loanRepo = loanRepo;
        this.loans = loans;
        this.ecl = ecl;
        this.assets = assets;
    }

    @GetMapping("/overview")
    Map<String, Object> overview(Actor actor, @RequestParam(required = false)
                                 @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOf) {
        actor.require("ops");
        LocalDate day = asOf == null ? LocalDate.now() : asOf;
        long accounts = 0;
        long depositsMinor = 0;
        for (String id : depositRepo.accountIds()) {
            accounts++;
            Money m = deposits.balance(id, day);
            if ("THB".equals(m.currency().code())) {
                depositsMinor += m.minor();
            }
        }
        long activeLoans = 0;
        long outstanding = 0;
        long nonPerforming = 0;
        long overdue = 0;
        for (String id : loanRepo.activeIds()) {
            Loan l = loanRepo.find(id).orElseThrow();
            activeLoans++;
            long out = l.instalments().stream().mapToLong(Loan.Instalment::principalOutstanding).sum();
            int dpd = loans.dpd(id, day);
            if ("THB".equals(l.currency())) {
                outstanding += out;
                if (dpd >= 90 || l.status() == Loan.Status.NON_ACCRUAL) {
                    nonPerforming += out;
                }
            }
            if (dpd > 0) {
                overdue++;
            }
        }
        long allowance = 0;
        for (String id : loanRepo.allIds()) {
            allowance += ecl.allowanceHeld(id, day);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("asOf", day);
        out.put("currency", "THB");
        out.put("depositAccounts", accounts);
        out.put("depositsMinor", depositsMinor);
        out.put("activeLoans", activeLoans);
        out.put("loansOutstandingMinor", outstanding);
        out.put("nonPerformingMinor", nonPerforming);
        out.put("nplRatio", outstanding == 0 ? 0.0 : (double) nonPerforming / outstanding);
        out.put("overdueLoans", overdue);
        out.put("uninsuredAssets", assets.uninsured(day).size());
        out.put("lossAllowanceMinor", allowance);
        return out;
    }
}
