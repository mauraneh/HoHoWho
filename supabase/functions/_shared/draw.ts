/**
 * Secret Santa draw algorithm.
 *
 * Pure, dependency-free TypeScript shared by the `draw-assignments` Edge Function (Deno)
 * and the local mock backend (Angular). Keep it free of imports so both runtimes can use it.
 */

export interface DrawPair {
  giverId: string;
  receiverId: string;
}

/** A pair of participants who must not draw each other (in either direction). */
export type ExclusionPair = readonly [string, string];

export class DrawImpossibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DrawImpossibleError';
  }
}

export const MIN_PARTICIPANTS = 3;
const MAX_STEPS = 200_000;

/** Uniform random float in [0, 1) backed by the Web Crypto API (available in browsers and Deno). */
export function secureRandom(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] / 0x1_0000_0000;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Assigns every participant exactly one receiver so that nobody draws themselves
 * and no excluded pair is matched. Uses randomized backtracking that always expands
 * the giver with the fewest remaining options first, which handles dense exclusion sets.
 *
 * @throws DrawImpossibleError when no valid assignment exists.
 */
export function drawAssignments(
  participantIds: readonly string[],
  exclusions: readonly ExclusionPair[] = [],
  random: () => number = secureRandom,
): DrawPair[] {
  const ids = [...new Set(participantIds)];
  if (ids.length !== participantIds.length) {
    throw new DrawImpossibleError('Participants must be unique.');
  }
  if (ids.length < MIN_PARTICIPANTS) {
    throw new DrawImpossibleError(`At least ${MIN_PARTICIPANTS} participants are required.`);
  }

  const forbidden = new Map<string, Set<string>>(ids.map((id) => [id, new Set([id])]));
  for (const [a, b] of exclusions) {
    forbidden.get(a)?.add(b);
    forbidden.get(b)?.add(a);
  }

  const candidates = new Map<string, string[]>(
    ids.map((giver) => [giver, shuffle(ids, random).filter((r) => !forbidden.get(giver)!.has(r))]),
  );

  const assignment = new Map<string, string>();
  const taken = new Set<string>();
  let steps = 0;

  const solve = (): boolean => {
    if (assignment.size === ids.length) return true;
    if (++steps > MAX_STEPS) return false;

    let bestGiver: string | null = null;
    let bestOptions: string[] = [];
    for (const giver of ids) {
      if (assignment.has(giver)) continue;
      const options = candidates.get(giver)!.filter((r) => !taken.has(r));
      if (options.length === 0) return false;
      if (bestGiver === null || options.length < bestOptions.length) {
        bestGiver = giver;
        bestOptions = options;
      }
    }

    for (const receiver of bestOptions) {
      assignment.set(bestGiver!, receiver);
      taken.add(receiver);
      if (solve()) return true;
      assignment.delete(bestGiver!);
      taken.delete(receiver);
    }
    return false;
  };

  if (!solve()) {
    throw new DrawImpossibleError(
      'No valid draw exists with the current exclusions. Remove some exclusions and try again.',
    );
  }

  return ids.map((giverId) => ({ giverId, receiverId: assignment.get(giverId)! }));
}
