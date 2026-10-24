import { useState, type FormEvent } from "react";
import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { Alert, Button, Card, Field, Input } from "@fabor/ui";
import { ApiError } from "@fabor/api";
import { api, ok, today } from "../../lib/api";
import { session } from "../../lib/session";

/**
 * Development sign-in: a name and the shared token of the app's token mode. The token is checked against the API before
 * the person is let in, so a typo shows here rather than as failures on every page. OIDC replaces this page in
 * production (ADR-0011).
 */
export function SignInPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { redirect } = useSearch({ strict: false }) as { redirect?: string };
  const [actor, setActor] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!actor.trim() || !token.trim()) { setError("Enter your name and the access token."); return; }
    setBusy(true); setError(null);
    session.signIn({ actor: actor.trim(), token: token.trim() });
    try {
      await ok(api.GET("/api/v1/overview", { params: { query: { asOf: today() } } }));
      // only an address inside this app: a sign-in link must not send people elsewhere
      if (redirect && redirect.startsWith("/") && !redirect.startsWith("//") && !redirect.startsWith("/sign-in")) void router.navigate({ href: redirect });
      else navigate({ to: "/" });
    } catch (err) {
      session.signOut();
      setError(err instanceof ApiError && err.status === 401 ? "The access token was not accepted." : err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signin">
      <div className="signin__card f-stack">
        <div className="side__brand"><span className="side__logo" aria-hidden="true">F</span>Fabor OS</div>
        <Card title="Sign in to the console">
          <form className="f-stack" onSubmit={submit} noValidate>
            <Field label="Your name" hint="Shown on everything you record.">
              {(p) => <Input {...p} autoComplete="username" value={actor} onChange={(e) => setActor(e.target.value)} autoFocus />}
            </Field>
            <Field label="Access token" hint="Development mode. Production uses your bank sign-in.">
              {(p) => <Input {...p} type="password" autoComplete="current-password" value={token} onChange={(e) => setToken(e.target.value)} />}
            </Field>
            {error && <Alert tone="crit">{error}</Alert>}
            <Button type="submit" variant="primary" busy={busy}>Sign in</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
