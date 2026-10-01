// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('EFFECT', () => {
  it('=EFFECT(0.0525, 4)', async () => {
    expect(await evaluate('=EFFECT(0.0525, 4)')).toBeCloseTo(0.05354266737075819, 9);
  });
  it('=EFFECT(0.1, 12)', async () => {
    expect(await evaluate('=EFFECT(0.1, 12)')).toBeCloseTo(0.10471306744129683, 9);
  });
  it('=EFFECT(0.1, 1)', async () => {
    expect(await evaluate('=EFFECT(0.1, 1)')).toBeCloseTo(0.10000000000000009, 9);
  });
  it('=EFFECT(0.1, 4.9)', async () => {
    expect(await evaluate('=EFFECT(0.1, 4.9)')).toBeCloseTo(0.10381289062499954, 9);
  });
  it('=EFFECT(0, 4)', async () => {
    expect(await evaluate('=EFFECT(0, 4)')).toMatchObject({ code: '#NUM!' });
  });
  it('=EFFECT(0.1, 0.5)', async () => {
    expect(await evaluate('=EFFECT(0.1, 0.5)')).toMatchObject({ code: '#NUM!' });
  });
  it('=EFFECT("x", 4)', async () => {
    expect(await evaluate('=EFFECT("x", 4)')).toMatchObject({ code: '#VALUE!' });
  });
});
