import { describe, expect, it } from 'vitest';
import { normalCdf, normalInv, normalPdf } from '../../src/helpers/normal';

describe('standard normal', () => {
  it('density', () => {
    expect(normalPdf(0)).toBeCloseTo(0.3989422804014327, 14);
    expect(normalPdf(1)).toBeCloseTo(0.24197072451914337, 14);
  });

  it('cumulative', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 14);
    expect(normalCdf(1.96)).toBeCloseTo(0.9750021048517795, 13);
    expect(normalCdf(-3)).toBeCloseTo(0.0013498980316301, 14);
  });

  it('inverse', () => {
    expect(normalInv(0.975)).toBeCloseTo(1.959963984540054, 12);
    expect(normalInv(0.5)).toBeCloseTo(0, 14);
    expect(normalInv(0.001)).toBeCloseTo(-3.090232306167813, 11);
    expect(normalInv(1)).toBeNaN();
  });
});
