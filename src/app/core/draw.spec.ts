import { DrawImpossibleError, drawAssignments, secureRandom } from '@shared/draw';

/** Small deterministic PRNG (mulberry32) so failures are reproducible. */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function expectValid(ids: string[], pairs: { giverId: string; receiverId: string }[]) {
  expect(pairs).toHaveLength(ids.length);
  expect(new Set(pairs.map((p) => p.giverId))).toEqual(new Set(ids));
  expect(new Set(pairs.map((p) => p.receiverId))).toEqual(new Set(ids));
  for (const p of pairs) expect(p.giverId).not.toBe(p.receiverId);
}

describe('drawAssignments', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('gives everyone exactly one receiver other than themselves', () => {
    for (let seed = 1; seed <= 200; seed++) {
      expectValid(ids, drawAssignments(ids, [], seeded(seed)));
    }
  });

  it('respects exclusions (giver → excluded receiver)', () => {
    const exclusions = [
      ['a', 'b'],
      ['b', 'a'],
      ['c', 'd'],
      ['e', 'f'],
      ['e', 'a'],
    ] as const;
    for (let seed = 1; seed <= 200; seed++) {
      const pairs = drawAssignments(ids, exclusions, seeded(seed));
      expectValid(ids, pairs);
      for (const { giverId, receiverId } of pairs) {
        expect(exclusions.some(([g, r]) => g === giverId && r === receiverId)).toBe(false);
      }
    }
  });

  it('treats exclusions as one-directional', () => {
    // a refuses b, but b may still draw a.
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      for (const p of drawAssignments(['a', 'b', 'c'], [['a', 'b']], seeded(seed))) {
        seen.add(`${p.giverId}>${p.receiverId}`);
      }
    }
    expect(seen.has('a>b')).toBe(false);
    expect(seen.has('b>a')).toBe(true);
  });

  it('finds the only valid solution in a heavily constrained group', () => {
    // a can only give to d and c only to b.
    const exclusions = [
      ['a', 'b'],
      ['a', 'c'],
      ['c', 'a'],
      ['c', 'd'],
    ] as const;
    for (let seed = 1; seed <= 50; seed++) {
      const pairs = drawAssignments(['a', 'b', 'c', 'd'], exclusions, seeded(seed));
      expectValid(['a', 'b', 'c', 'd'], pairs);
      expect(pairs.find((p) => p.giverId === 'a')!.receiverId).toBe('d');
      expect(pairs.find((p) => p.giverId === 'c')!.receiverId).toBe('b');
    }
  });

  it('varies between draws', () => {
    const results = new Set(
      Array.from({ length: 30 }, (_, i) => JSON.stringify(drawAssignments(ids, [], seeded(i + 1)))),
    );
    expect(results.size).toBeGreaterThan(5);
  });

  it('rejects groups that are too small', () => {
    expect(() => drawAssignments(['a', 'b'])).toThrow(DrawImpossibleError);
  });

  it('rejects duplicate participants', () => {
    expect(() => drawAssignments(['a', 'a', 'b'])).toThrow(DrawImpossibleError);
  });

  it('reports impossible exclusion sets', () => {
    // b and c both refuse a: nobody can give to a.
    expect(() =>
      drawAssignments(
        ['a', 'b', 'c'],
        [
          ['b', 'a'],
          ['c', 'a'],
        ],
      ),
    ).toThrow(DrawImpossibleError);
    const exclusions = [
      ['a', 'b'],
      ['a', 'c'],
      ['a', 'd'],
    ] as const;
    expect(() => drawAssignments(['a', 'b', 'c', 'd'], exclusions)).toThrow(/No valid draw/);
  });

  it('uses a cryptographic random source by default', () => {
    for (let i = 0; i < 100; i++) {
      const value = secureRandom();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    expectValid(ids, drawAssignments(ids));
  });

  it('handles large groups quickly', () => {
    const many = Array.from({ length: 300 }, (_, i) => `p${i}`);
    const exclusions = many
      .slice(0, 150)
      .flatMap((id, i) => [[id, many[i + 150]] as const, [many[i + 150], id] as const]);
    expectValid(many, drawAssignments(many, exclusions, seeded(3)));
  });
});
