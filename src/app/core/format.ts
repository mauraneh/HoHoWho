import { BackendError } from './backend/hohowho-backend';
import { GENERIC_ERROR, translateError } from './error-messages';

export function errorMessage(error: unknown): string {
  if (error instanceof BackendError) return translateError(error.message);
  console.error(error);
  return GENERIC_ERROR;
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatBudget(min: number | null, max: number | null, currency: string): string {
  if (min !== null && max !== null) {
    return min === max
      ? formatMoney(max, currency)
      : `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
  }
  if (max !== null) return `Jusqu’à ${formatMoney(max, currency)}`;
  if (min !== null) return `À partir de ${formatMoney(min, currency)}`;
  return 'Budget libre';
}

/** Only allow navigating back to in-app paths (prevents open redirects through ?returnUrl=). */
export function safeReturnUrl(value: string | null | undefined): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/events';
}

/** Builds a mailto: link that opens the user's own mail app (no e-mail service needed). */
export function mailtoLink(bcc: string[], subject: string, body: string): string {
  const params = [`subject=${encodeURIComponent(subject)}`, `body=${encodeURIComponent(body)}`];
  if (bcc.length) params.unshift(`bcc=${bcc.map(encodeURIComponent).join(',')}`);
  return `mailto:?${params.join('&')}`;
}

/** Absolute URL of an in-app path, valid on any host and base path (hash routing). */
export function appUrl(path: string): string {
  return new URL(`#${path}`, document.baseURI.split('#')[0]).toString();
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('') || '?'
  );
}
