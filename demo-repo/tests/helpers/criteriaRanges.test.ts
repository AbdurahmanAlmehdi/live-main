import { describe, expect, it } from 'vitest';
import { err } from '../../src/core/errors';
import { matchingIndices } from '../../src/helpers/criteriaRanges';

describe('matchingIndices', () => {
  it('matches a single scalar range', () => {
    expect(matchingIndices([{ range: 5, criterion: '>3' }])).toEqual([0]);
    expect(matchingIndices([{ range: 2, criterion: '>3' }])).toEqual([]);
  });

  it('requires every criterion to hold', () => {
    expect(matchingIndices([{ range: 5, criterion: '>3' }, { range: 'a', criterion: 'a' }])).toEqual([0]);
    expect(matchingIndices([{ range: 5, criterion: '>3' }, { range: 'b', criterion: 'a' }])).toEqual([]);
  });

  it('returns errors in criteria and rejects no criteria', () => {
    expect(matchingIndices([{ range: 5, criterion: err.na }])).toMatchObject({ code: '#N/A' });
    expect(matchingIndices([])).toMatchObject({ code: '#VALUE!' });
  });
});
