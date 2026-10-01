// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('CSCH', () => {
  it('=CSCH(1.5)', async () => {
    expect(await evaluate('=CSCH(1.5)')).toBeCloseTo(0.46964244059522464, 9);
  });
  it('=CSCH(-1)', async () => {
    expect(await evaluate('=CSCH(-1)')).toBeCloseTo(-0.8509181282393216, 9);
  });
  it('=CSCH(5)', async () => {
    expect(await evaluate('=CSCH(5)')).toBeCloseTo(0.013476505830589089, 9);
  });
  it('=CSCH(0)', async () => {
    expect(await evaluate('=CSCH(0)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=CSCH("x")', async () => {
    expect(await evaluate('=CSCH("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
