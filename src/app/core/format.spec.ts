import { BackendError } from './backend/hohowho-backend';
import { errorMessage, formatBudget, safeReturnUrl } from './format';

describe('format helpers', () => {
  it('only allows in-app return URLs', () => {
    expect(safeReturnUrl('/join/abc')).toBe('/join/abc');
    expect(safeReturnUrl('//evil.example')).toBe('/events');
    expect(safeReturnUrl('https://evil.example')).toBe('/events');
    expect(safeReturnUrl(undefined)).toBe('/events');
  });

  it('formats budgets', () => {
    expect(formatBudget(null, null, 'EUR')).toBe('Budget libre');
    expect(formatBudget(null, 30, 'EUR')).toContain('30');
    expect(formatBudget(10, 30, 'EUR')).toMatch(/10.*30/);
  });

  it('only exposes messages of known errors', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(errorMessage(new BackendError('Names have already been drawn for this event'))).toBe(
      'Le tirage a déjà eu lieu pour ce Secret Santa.',
    );
    expect(errorMessage(new BackendError('Waiting for 2 participant(s) to validate'))).toContain(
      '2',
    );
    expect(errorMessage(new Error('internal details'))).toBe('Une erreur est survenue. Réessayez.');
  });
});
