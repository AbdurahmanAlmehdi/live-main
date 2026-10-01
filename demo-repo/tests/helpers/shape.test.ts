import { describe, expect, it } from 'vitest';
import { kurtosis, skewness } from '../../src/helpers/shape';

describe('skewness', () => {
  it('computes the sample skewness', () => {
    expect(skewness([3, 4, 5, 2, 3, 4, 5, 6, 4, 7])).toBeCloseTo(0.359543071407054, 12);
    expect(skewness([1, 2, 3])).toBeCloseTo(0, 12);
  });

  it('needs three values and some spread', () => {
    expect(skewness([1, 2])).toMatchObject({ code: '#DIV/0!' });
    expect(skewness([2, 2, 2])).toMatchObject({ code: '#DIV/0!' });
  });
});

describe('kurtosis', () => {
  it('computes the sample excess kurtosis', () => {
    expect(kurtosis([3, 4, 5, 2, 3, 4, 5, 6, 4, 7])).toBeCloseTo(-0.151799637208218, 12);
  });

  it('needs four values and some spread', () => {
    expect(kurtosis([1, 2, 3])).toMatchObject({ code: '#DIV/0!' });
    expect(kurtosis([1, 1, 1, 1])).toMatchObject({ code: '#DIV/0!' });
  });
});
