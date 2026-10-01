// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('NUMBERVALUE', () => {
  it('=NUMBERVALUE("2.500,27", ",", ".")', async () => {
    expect(await evaluate('=NUMBERVALUE("2.500,27", ",", ".")')).toBeCloseTo(2500.27, 5);
  });
  it('=NUMBERVALUE("3.5%")', async () => {
    expect(await evaluate('=NUMBERVALUE("3.5%")')).toBeCloseTo(0.035, 9);
  });
  it('=NUMBERVALUE("1 234.5")', async () => {
    expect(await evaluate('=NUMBERVALUE("1 234.5")')).toBeCloseTo(1234.5, 5);
  });
  it('=NUMBERVALUE("1,234.5")', async () => {
    expect(await evaluate('=NUMBERVALUE("1,234.5")')).toBeCloseTo(1234.5, 5);
  });
  it('=NUMBERVALUE("")', async () => {
    expect(await evaluate('=NUMBERVALUE("")')).toBeCloseTo(0, 9);
  });
  it('=NUMBERVALUE("1.2.3")', async () => {
    expect(await evaluate('=NUMBERVALUE("1.2.3")')).toMatchObject({ code: '#VALUE!' });
  });
});
