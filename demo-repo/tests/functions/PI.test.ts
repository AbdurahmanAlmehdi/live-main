// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('PI', () => {
  it('=PI()', async () => {
    expect(await evaluate('=PI()')).toBeCloseTo(3.141592653589793, 8);
  });
  it('=PI()*2', async () => {
    expect(await evaluate('=PI()*2')).toBeCloseTo(6.283185307179586, 8);
  });
  it('=PI()/2', async () => {
    expect(await evaluate('=PI()/2')).toBeCloseTo(1.5707963267948966, 8);
  });
  it('=-PI()', async () => {
    expect(await evaluate('=-PI()')).toBeCloseTo(-3.141592653589793, 8);
  });
});
