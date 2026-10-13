import { BackendError } from './backend/hohowho-backend';

export function errorMessage(error: unknown): string {
  if (error instanceof BackendError) return error.message;
  console.error(error);
  return 'Something went wrong. Please try again.';
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
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
  if (max !== null) return `Up to ${formatMoney(max, currency)}`;
  if (min !== null) return `From ${formatMoney(min, currency)}`;
  return 'No budget set';
}

/** Only allow navigating back to in-app paths (prevents open redirects through ?returnUrl=). */
export function safeReturnUrl(value: string | null | undefined): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/events';
}
