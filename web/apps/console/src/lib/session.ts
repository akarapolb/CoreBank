import { useSyncExternalStore } from "react";
import type { Session } from "@fabor/api";

/**
 * Who is signed in. Development token mode keeps the bearer token and the actor name for this browser tab only
 * (sessionStorage), so closing the tab signs out. OIDC sign-in replaces this store later (ADR-0011).
 */
const KEY = "fabor.session";
const listeners = new Set<() => void>();

function read(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

let current: Session | null = read();

export const session = {
  get: () => current,
  signIn(next: Session) {
    current = next;
    try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable: stay signed in for this page only */ }
    listeners.forEach((l) => l());
  },
  signOut() {
    current = null;
    try { sessionStorage.removeItem(KEY); } catch { /* nothing stored */ }
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
};

export function useSession(): Session | null {
  return useSyncExternalStore(session.subscribe, session.get, session.get);
}
