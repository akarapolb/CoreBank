import { ApiError, explain } from "./index";

describe("service messages are rewritten so people never read satang or ledger ids", () => {
  it("turns amounts in minor units into baht", () => {
    expect(explain("Payment exceeds what is due by 300000")).toBe("Payment exceeds what is due by ฿3,000.00");
    expect(explain("The drawdown exceeds the USED sub-limit by 2000000")).toBe("The drawdown exceeds the USED sub-limit by ฿20,000.00");
    expect(explain("The call-off exceeds the facility headroom of 40000000")).toBe("The call-off exceeds the facility headroom of ฿400,000.00");
    expect(explain("A promise is for more than zero and at most the amount overdue (8251200)"))
      .toBe("A promise is for more than zero and at most the amount overdue (฿82,512.00)");
  });

  it("says which account is short in words", () => {
    expect(explain("Insufficient funds on dep:SAV-C14")).toBe("Account SAV-C14 does not have enough money for this. Fund it and try again.");
  });

  it("leaves other messages as they are", () => {
    expect(explain("Loan LN-1 is CLOSED")).toBe("Loan LN-1 is CLOSED");
  });

  it("carries the HTTP status with the rewritten message", () => {
    const e = new ApiError(422, "Insufficient funds on dep:SAV-1");
    expect(e.status).toBe(422);
    expect(e.message).toMatch(/^Account SAV-1/);
  });
});
