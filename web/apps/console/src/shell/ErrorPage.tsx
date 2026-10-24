import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { Alert, Button, Card } from "@fabor/ui";

/**
 * When a page breaks, say so plainly, keep the person's work safe (nothing was posted by a page that failed to draw),
 * and give them a way forward. The technical detail is there for a support ticket, not as the headline.
 */
export function ErrorPage({ error, reset }: ErrorComponentProps) {
  return (
    <div className="signin">
      <div className="signin__card f-stack">
        <Card title="This page could not be shown">
          <div className="f-stack">
            <p>Nothing was changed. You can try again, or go back to Home and continue from there.</p>
            <Alert tone="crit" title="Details for support">{error instanceof Error ? error.message : String(error)}</Alert>
            <div className="f-row">
              <Button variant="primary" onClick={() => reset()}>Try again</Button>
              <Link to="/" className="f-btn">Go to Home</Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="signin">
      <div className="signin__card f-stack">
        <Card title="There is no page at this address">
          <div className="f-stack">
            <p>The link may be out of date. Search for the record instead, or start from Home.</p>
            <div className="f-row"><Link to="/" className="f-btn f-btn--primary">Go to Home</Link></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/** The same message inside the shell, so the navigation stays and the person can move on. */
export function InlineErrorPage({ error, reset }: ErrorComponentProps) {
  return (
    <Card title="This page could not be shown">
      <div className="f-stack">
        <p>Nothing was changed. Try again, or choose another page from the menu.</p>
        <Alert tone="crit" title="Details for support">{error instanceof Error ? error.message : String(error)}</Alert>
        <div className="f-row"><Button variant="primary" onClick={() => reset()}>Try again</Button></div>
      </div>
    </Card>
  );
}
