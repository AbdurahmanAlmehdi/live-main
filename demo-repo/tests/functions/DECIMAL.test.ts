// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('DECIMAL', () => {
  it('=DECIMAL("FF", 16)', async () => {
    expect(await evaluate('=DECIMAL("FF", 16)')).toBeCloseTo(255, 6);
  });
  it('=DECIMAL("111", 2)', async () => {
    expect(await evaluate('=DECIMAL("111", 2)')).toBeCloseTo(7, 8);
  });
  it('=DECIMAL("zap", 36)', async () => {
    expect(await evaluate('=DECIMAL("zap", 36)')).toBeCloseTo(45745, 4);
  });
  it('=DECIMAL("FFFFFFFFFF", 16)', async () => {
    expect(await evaluate('=DECIMAL("FFFFFFFFFF", 16)')).toBeCloseTo(1099511627775, -4);
  });
  it('=DECIMAL("1111111111", 2)', async () => {
    expect(await evaluate('=DECIMAL("1111111111", 2)')).toBeCloseTo(1023, 5);
  });
  it('=DECIMAL("12", 2)', async () => {
    expect(await evaluate('=DECIMAL("12", 2)')).toMatchObject({ code: '#NUM!' });
  });
  it('=DECIMAL("10", 37)', async () => {
    expect(await evaluate('=DECIMAL("10", 37)')).toMatchObject({ code: '#NUM!' });
  });
});
