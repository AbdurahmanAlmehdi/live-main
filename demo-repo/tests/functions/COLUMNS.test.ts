// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('COLUMNS', () => {
  it('=COLUMNS({1, 2, 3})', async () => {
    expect(await evaluate('=COLUMNS({1, 2, 3})')).toBeCloseTo(3, 8);
  });
  it('=COLUMNS({1; 2; 3})', async () => {
    expect(await evaluate('=COLUMNS({1; 2; 3})')).toBeCloseTo(1, 9);
  });
  it('=COLUMNS({1, 2; 3, 4})', async () => {
    expect(await evaluate('=COLUMNS({1, 2; 3, 4})')).toBeCloseTo(2, 8);
  });
  it('=COLUMNS(5)', async () => {
    expect(await evaluate('=COLUMNS(5)')).toBeCloseTo(1, 9);
  });
});
