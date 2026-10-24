import { channel, loanStatus, nextStep } from "./labels";
import { payableNow } from "../features/loans/LoanPage";

describe("plain language for codes", () => {
  it("never shows an overdue loan as a green Active", () => {
    expect(loanStatus("ACTIVE")).toEqual({ text: "Active", tone: "good" });
    expect(loanStatus("ACTIVE", 12)).toEqual({ text: "Late · 12 days", tone: "warn" });
    expect(loanStatus("ACTIVE", 205)).toEqual({ text: "205 days late", tone: "crit" });
    expect(loanStatus("WRITTEN_OFF", 0).text).toBe("Written off");
  });

  it("reads a new code in sentence case rather than as a raw constant", () => {
    expect(loanStatus("IN_RECOVERY").text).toBe("In recovery");
    expect(nextStep("RESTRUCTURE_REVIEW").text).toBe("Review for restructuring");
    expect(nextStep("SOMETHING_NEW").text).toBe("Something new");
    expect(channel("VISIT")).toBe("Visit");
  });
});

describe("payable now", () => {
  it("adds what is billed and unpaid, and ignores paid and unbilled instalments", () => {
    const i = (n: number, billed: boolean, settled: boolean, p: number, ip: number, pen = 0) => ({
      number: n, dueDate: "2026-01-01", principalMinor: 1000, interestMinor: 100, principalPaidMinor: p, interestPaidMinor: ip,
      penaltyMinor: pen, billed, settled,
    });
    const loan = { instalments: [i(1, true, true, 1000, 100), i(2, true, false, 400, 100, 7), i(3, false, false, 0, 0)] };
    expect(payableNow(loan as never)).toBe(600 + 0 + 7);
  });
});
