// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('DATEVALUE', () => {
  it('=DATEVALUE("2020-01-15")', async () => {
    expect(await evaluate('=DATEVALUE("2020-01-15")')).toBeCloseTo(43845, 4);
  });
  it('=DATEVALUE("1/15/2020")', async () => {
    expect(await evaluate('=DATEVALUE("1/15/2020")')).toBeCloseTo(43845, 4);
  });
  it('=DATEVALUE("15-Jan-2020")', async () => {
    expect(await evaluate('=DATEVALUE("15-Jan-2020")')).toBeCloseTo(43845, 4);
  });
  it('=DATEVALUE("January 15, 2020")', async () => {
    expect(await evaluate('=DATEVALUE("January 15, 2020")')).toBeCloseTo(43845, 4);
  });
  it('=DATEVALUE("2020-02-30")', async () => {
    expect(await evaluate('=DATEVALUE("2020-02-30")')).toMatchObject({ code: '#VALUE!' });
  });
  it('=DATEVALUE("hello")', async () => {
    expect(await evaluate('=DATEVALUE("hello")')).toMatchObject({ code: '#VALUE!' });
  });
  it('=DATEVALUE(43845)', async () => {
    expect(await evaluate('=DATEVALUE(43845)')).toMatchObject({ code: '#VALUE!' });
  });
});
