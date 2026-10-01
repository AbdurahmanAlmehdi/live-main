// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SEC', () => {
  it('=SEC(45)', async () => {
    expect(await evaluate('=SEC(45)')).toBeCloseTo(1.9035944074044246, 8);
  });
  it('=SEC(0)', async () => {
    expect(await evaluate('=SEC(0)')).toBeCloseTo(1, 9);
  });
  it('=SEC(-1)', async () => {
    expect(await evaluate('=SEC(-1)')).toBeCloseTo(1.8508157176809255, 8);
  });
  it('=SEC(PI())', async () => {
    expect(await evaluate('=SEC(PI())')).toBeCloseTo(-1, 9);
  });
  it('=SEC("x")', async () => {
    expect(await evaluate('=SEC("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
