import { safeReturnUrl } from './format';

const KEY = 'hohowho.next';

/**
 * Remembers where to go after following an e-mailed sign-in link (e.g. an invitation).
 * The path travels in the link itself (`?next=`) so it works on another device, and is also kept
 * in localStorage as a fallback when the auth server drops the query string.
 */
export function rememberNext(path: string): void {
  try {
    localStorage.setItem(KEY, safeReturnUrl(path));
  } catch {
    // Storage unavailable (private mode): the ?next= parameter still works.
  }
}

/** Moves a `?next=` query parameter into storage and removes it from the address bar. */
export function captureNextFromUrl(): void {
  const url = new URL(window.location.href);
  const next = url.searchParams.get('next');
  if (!next) return;
  rememberNext(next);
  url.searchParams.delete('next');
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}

/** Returns and forgets the remembered path, if any. */
export function takeNext(): string | null {
  try {
    const value = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    return value ? safeReturnUrl(value) : null;
  } catch {
    return null;
  }
}
