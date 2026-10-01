// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('CONFIDENCE.NORM', () => {
  it('=CONFIDENCE.NORM(0.05, 2.5, 50)', async () => {
    expect(await evaluate('=CONFIDENCE.NORM(0.05, 2.5, 50)')).toBeCloseTo(0.6929519121748391, 9);
  });
  it('=CONFIDENCE.NORM(0.1, 1, 10)', async () => {
    expect(await evaluate('=CONFIDENCE.NORM(0.1, 1, 10)')).toBeCloseTo(0.5201483878755575, 9);
  });
  it('=CONFIDENCE.NORM(0.01, 3, 100)', async () => {
    expect(await evaluate('=CONFIDENCE.NORM(0.01, 3, 100)')).toBeCloseTo(0.7727487910646706, 9);
  });
  it('=CONFIDENCE.NORM(0.05, 2.5, 50.9)', async () => {
    expect(await evaluate('=CONFIDENCE.NORM(0.05, 2.5, 50.9)')).toBeCloseTo(0.692951912174839, 9);
  });
  it('=CONFIDENCE.NORM(0, 1, 10)', async () => {
    expect(await evaluate('=CONFIDENCE.NORM(0, 1, 10)')).toMatchObject({ code: '#NUM!' });
  });
  it('=CONFIDENCE.NORM(0.05, 0, 10)', async () => {
    expect(await evaluate('=CONFIDENCE.NORM(0.05, 0, 10)')).toMatchObject({ code: '#NUM!' });
  });
  it('=CONFIDENCE.NORM(0.05, 1, 0.5)', async () => {
    expect(await evaluate('=CONFIDENCE.NORM(0.05, 1, 0.5)')).toMatchObject({ code: '#NUM!' });
  });
  it('=CONFIDENCE.NORM("x", 1, 10)', async () => {
    expect(await evaluate('=CONFIDENCE.NORM("x", 1, 10)')).toMatchObject({ code: '#VALUE!' });
  });
});
