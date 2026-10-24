import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ActionDialog } from "./ActionDialog";
import { DataTable } from "./DataTable";

beforeAll(() => {
  // jsdom has no modal dialogs
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.removeAttribute("open"); };
  }
});

describe("ActionDialog", () => {
  it("goes enter, review, done; validation stops at enter; one reference per opening", async () => {
    const submit = vi.fn(async (_ref: string) => ({ tone: "good" as const, message: "Recorded." }));
    let valid = false;
    render(
      <ActionDialog open onClose={() => {}} title="Record payment" confirmLabel="Record" validate={() => (valid ? null : "Enter an amount.")}
        review={() => <span>Take ฿1.00</span>} submit={submit}>
        <input aria-label="Amount" />
      </ActionDialog>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByText("Enter an amount.")).toBeInTheDocument();
    valid = true;
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByText("Take ฿1.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    await waitFor(() => expect(screen.getByText("Recorded.")).toBeInTheDocument());
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]?.[0]).toMatch(/^console-/);
  });

  it("keeps an irreversible action locked until the exact confirmation is typed, and shows a refusal without leaving review", async () => {
    const submit = vi.fn(async () => { throw new Error("Account SAV-1 does not have enough money for this."); });
    render(
      <ActionDialog open onClose={() => {}} title="Settle" confirmLabel="Settle" irreversible confirmText="LN-1"
        review={() => <span>Settles LN-1</span>} submit={submit} />,
    );
    const confirm = screen.getByRole("button", { name: "Settle" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "LN-2" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "LN-1" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.getByText(/does not have enough money/)).toBeInTheDocument());
    expect(screen.getByText("Settles LN-1")).toBeInTheDocument();
  });
});

describe("DataTable", () => {
  const columns = [
    { key: "id", header: "Loan", render: (r: { id: string }) => <a className="f-row-link" href={`/loans/${r.id}`}>{r.id}</a> },
    { key: "amt", header: "Amount", align: "end" as const, render: () => "฿1.00" },
  ];

  it("makes each row a real link that keyboards and screen readers reach by its name", () => {
    render(<DataTable caption="Loans" columns={columns} rows={[{ id: "LN-1" }, { id: "LN-2" }]} rowKey={(r) => r.id} rowsAreLinks />);
    expect(screen.getByRole("table", { name: "Loans" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "LN-2" })).toHaveAttribute("href", "/loans/LN-2");
    expect(screen.getAllByRole("row")[1]).toHaveClass("is-link");
    expect(screen.getByRole("columnheader", { name: "Amount" })).toHaveClass("is-num");
  });

  it("says what to do when there is nothing to show", () => {
    render(<DataTable caption="Loans" columns={columns} rows={[]} rowKey={(r) => r.id} emptyTitle="No loan matches" emptyText="Try part of the id." />);
    expect(screen.getByText("No loan matches")).toBeInTheDocument();
    expect(screen.getByText("Try part of the id.")).toBeInTheDocument();
  });
});
