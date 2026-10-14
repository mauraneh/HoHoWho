import { appUrl } from './format';

const KEY = 'hohowho.personal-key';

/** Full URL of a personal link. */
export function personalLinkUrl(key: string): string {
  return appUrl(`/k/${key}`);
}

/** Extracts a personal key from a pasted personal link (or a bare key). */
export function keyFromInput(value: string): string {
  const text = value.trim();
  const match = text.match(/#\/k\/([^/?#\s]+)/);
  return decodeURIComponent(match ? match[1] : text);
}

/** Keeps the current device's personal key so "Mon lien" can show it again. */
export function rememberKey(key: string): void {
  try {
    localStorage.setItem(KEY, key);
  } catch {
    // Storage unavailable: the link is still shown once.
  }
}

export function rememberedKey(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function forgetKey(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
}
