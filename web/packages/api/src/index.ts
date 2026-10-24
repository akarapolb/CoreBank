import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";

export type { paths, components } from "./schema";

const baht = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMoney = (minor: number) => `฿${baht.format(minor / 100)}`;

/** Who is signed in. In the development token mode the actor is a name sent as X-Actor; with OIDC it is in the token. */
export type Session = { token: string; actor?: string };

/** An API refusal, with the HTTP status and the service's own message turned into words a person can act on. */
export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(explain(message));
  }
}

/**
 * Service messages still carry some amounts in minor units ("exceeds what is due by 300000"). Until the services say it
 * in baht, these known phrases are rewritten so people never read satang (UX foundation, finding F8).
 */
export function explain(message: string): string {
  return message
    .replace(/(exceeds what is due by|exceeds the line limit by|sub-limit by|headroom of) (\d+)/g, (_, phrase: string, n: string) => `${phrase} ${formatMoney(Number(n))}`)
    .replace(/the amount overdue \((\d+)\)/g, (_, n: string) => `the amount overdue (${formatMoney(Number(n))})`)
    .replace(/still owed \((\d+)\)/g, (_, n: string) => `still owed (${formatMoney(Number(n))})`)
    .replace(/^Insufficient funds on dep:(\S+)$/, "Account $1 does not have enough money for this. Fund it and try again.")
    .replace(/^Insufficient funds on (\S+)$/, "$1 does not have enough money for this. Fund it and try again.");
}

export function createApi(session: () => Session | null, baseUrl = "") {
  const client = createClient<paths>({ baseUrl });
  const auth: Middleware = {
    onRequest({ request }) {
      const s = session();
      if (s) {
        request.headers.set("Authorization", `Bearer ${s.token}`);
        if (s.actor) request.headers.set("X-Actor", s.actor);
      }
      return request;
    },
  };
  client.use(auth);
  return client;
}

export type Api = ReturnType<typeof createApi>;

/** Unwraps an openapi-fetch result: the data, or an {@link ApiError} with the service's message. */
export async function ok<T>(call: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  const { data, error, response } = await call;
  if (!response.ok || error !== undefined) {
    const body = error as { message?: string; error?: string } | undefined;
    throw new ApiError(response.status, body?.message ?? body?.error ?? `The service answered ${response.status}`);
  }
  return data as T;
}
