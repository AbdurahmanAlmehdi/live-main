// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('DDB', () => {
  it('=DDB(2400, 300, 10*365, 1)', async () => {
    expect(await evaluate('=DDB(2400, 300, 10*365, 1)')).toBeCloseTo(1.3150684931506849, 8);
  });
  it('=DDB(2400, 300, 10*12, 1, 2)', async () => {
    expect(await evaluate('=DDB(2400, 300, 10*12, 1, 2)')).toBeCloseTo(40, 7);
  });
  it('=DDB(2400, 300, 10, 1, 2)', async () => {
    expect(await evaluate('=DDB(2400, 300, 10, 1, 2)')).toBeCloseTo(480, 6);
  });
  it('=DDB(2400, 300, 10, 2, 1.5)', async () => {
    expect(await evaluate('=DDB(2400, 300, 10, 2, 1.5)')).toBeCloseTo(306, 6);
  });
  it('=DDB(2400, 300, 10, 10)', async () => {
    expect(await evaluate('=DDB(2400, 300, 10, 10)')).toBeCloseTo(22.1225472000001, 7);
  });
  it('=DDB(1000, 100, 2, 1, 3)', async () => {
    expect(await evaluate('=DDB(1000, 100, 2, 1, 3)')).toBeCloseTo(900, 6);
  });
  it('=DDB(1000, 100, 5, 0)', async () => {
    expect(await evaluate('=DDB(1000, 100, 5, 0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=DDB(1000, 100, 5, 6)', async () => {
    expect(await evaluate('=DDB(1000, 100, 5, 6)')).toMatchObject({ code: '#NUM!' });
  });
  it('=DDB(1000, 100, 5, 1, 0)', async () => {
    expect(await evaluate('=DDB(1000, 100, 5, 1, 0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=DDB("x", 100, 5, 1)', async () => {
    expect(await evaluate('=DDB("x", 100, 5, 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
