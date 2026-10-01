// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('UNICODE', () => {
  it('=UNICODE("B")', async () => {
    expect(await evaluate('=UNICODE("B")')).toBeCloseTo(66, 7);
  });
  it('=UNICODE(" ")', async () => {
    expect(await evaluate('=UNICODE(" ")')).toBeCloseTo(32, 7);
  });
  it('=UNICODE("€uro")', async () => {
    expect(await evaluate('=UNICODE("€uro")')).toBeCloseTo(8364, 5);
  });
  it('=UNICODE(UNICHAR(128512))', async () => {
    expect(await evaluate('=UNICODE(UNICHAR(128512))')).toBeCloseTo(128512, 3);
  });
  it('=UNICODE("")', async () => {
    expect(await evaluate('=UNICODE("")')).toMatchObject({ code: '#VALUE!' });
  });
});
