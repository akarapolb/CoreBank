import { formatDate, formatMoney, formatPercent, parseMoney, plural } from "./format";

describe("money", () => {
  it("shows minor units as baht with two decimals and a real minus sign", () => {
    expect(formatMoney(123456)).toBe("฿1,234.56");
    expect(formatMoney(0)).toBe("฿0.00");
    expect(formatMoney(-500)).toBe("−฿5.00");
    expect(formatMoney(100, "USD")).toBe("$1.00");
    expect(formatMoney(100, "JPY")).toBe("1.00 JPY");
  });

  it("reads what people type, with or without separators and the baht sign", () => {
    expect(parseMoney("1250")).toBe(125000);
    expect(parseMoney("1,250.5")).toBe(125050);
    expect(parseMoney(" ฿20,000.00 ")).toBe(2000000);
    expect(parseMoney("0.07")).toBe(7);
  });

  it("refuses what is not an amount instead of guessing", () => {
    for (const bad of ["", "abc", "1.234", "-5", "1e3", "12.3.4"]) expect(parseMoney(bad)).toBeNull();
  });
});

describe("dates and counts", () => {
  it("formats API dates without shifting the day across time zones", () => {
    expect(formatDate("2026-10-24")).toBe("24 Oct 2026");
    expect(formatDate("2026-01-01T00:00:00Z")).toBe("1 Jan 2026");
    expect(formatDate(undefined)).toBe("—");
  });

  it("formats percentages and plurals", () => {
    expect(formatPercent(0.3321)).toBe("33.21%");
    expect(formatPercent(0.92, 0)).toBe("92%");
    expect(plural(1, "loan")).toBe("1 loan");
    expect(plural(1200, "loan")).toBe("1,200 loans");
  });
});
