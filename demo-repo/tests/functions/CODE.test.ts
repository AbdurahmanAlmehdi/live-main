// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('CODE', () => {
  it('=CODE("A")', async () => {
    expect(await evaluate('=CODE("A")')).toBeCloseTo(65, 7);
  });
  it('=CODE("alpha")', async () => {
    expect(await evaluate('=CODE("alpha")')).toBeCloseTo(97, 7);
  });
  it('=CODE("!")', async () => {
    expect(await evaluate('=CODE("!")')).toBeCloseTo(33, 7);
  });
  it('=CODE(1)', async () => {
    expect(await evaluate('=CODE(1)')).toBeCloseTo(49, 7);
  });
  it('=CODE("")', async () => {
    expect(await evaluate('=CODE("")')).toMatchObject({ code: '#VALUE!' });
  });
});
