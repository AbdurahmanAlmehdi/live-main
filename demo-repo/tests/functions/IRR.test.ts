// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('IRR', () => {
  it('=IRR({-70000, 12000, 15000, 18000, 21000})', async () => {
    expect(await evaluate('=IRR({-70000, 12000, 15000, 18000, 21000})')).toBeCloseTo(-0.02124484825348074, 9);
  });
  it('=IRR({-70000, 12000, 15000, 18000, 21000, 26000})', async () => {
    expect(await evaluate('=IRR({-70000, 12000, 15000, 18000, 21000, 26000})')).toBeCloseTo(0.0866309480595222, 9);
  });
  it('=IRR({-70000, 12000, 15000}, -0.1)', async () => {
    expect(await evaluate('=IRR({-70000, 12000, 15000}, -0.1)')).toBeCloseTo(-0.44350694136464036, 9);
  });
  it('=IRR({-100, 110})', async () => {
    expect(await evaluate('=IRR({-100, 110})')).toBeCloseTo(0.1, 9);
  });
  it('=IRR({-1000, 100, 100, 100, 1200}, 0.05)', async () => {
    expect(await evaluate('=IRR({-1000, 100, 100, 100, 1200}, 0.05)')).toBeCloseTo(0.1208959937165161, 9);
  });
  it('=IRR({-100, "x", 50, 60})', async () => {
    expect(await evaluate('=IRR({-100, "x", 50, 60})')).toBeCloseTo(0.0639410298049854, 9);
  });
  it('=IRR({100, 200})', async () => {
    expect(await evaluate('=IRR({100, 200})')).toMatchObject({ code: '#NUM!' });
  });
  it('=IRR({-100, -200})', async () => {
    expect(await evaluate('=IRR({-100, -200})')).toMatchObject({ code: '#NUM!' });
  });
});
