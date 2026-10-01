import { describe, expect, it } from 'vitest';
import { cellsOf, dimensions, fromColumn, fromRow, fromRows, isVector, mapCells, toRange, transpose } from '../../src/core/range';
import { RangeValue, isRange, toMatrix } from '../../src/core/value';

describe('RangeValue', () => {
  it('exposes its shape and cells', () => {
    const r = new RangeValue([[1, 2, 3], [4, 5, 6]]);
    expect([r.height, r.width]).toEqual([2, 3]);
    expect(r.at(1, 2)).toBe(6);
    expect(isRange(r)).toBe(true);
    expect(isRange(1)).toBe(false);
  });

  it('rejects empty and ragged ranges', () => {
    expect(() => new RangeValue([])).toThrow(RangeError);
    expect(() => new RangeValue([[1], [1, 2]])).toThrow(RangeError);
  });
});

describe('range helpers', () => {
  it('wraps scalars', () => {
    expect(toMatrix(toRange(5))).toEqual([[5]]);
    expect(dimensions(5)).toEqual([1, 1]);
    expect(cellsOf('a')).toEqual(['a']);
  });

  it('builds ranges', () => {
    expect(toMatrix(fromColumn([1, 2]))).toEqual([[1], [2]]);
    expect(toMatrix(fromRow([1, 2]))).toEqual([[1, 2]]);
    expect(dimensions(fromRows([[1, 2], [3, 4], [5, 6]]))).toEqual([3, 2]);
  });

  it('flattens, maps and transposes', () => {
    const r = fromRows([[1, 2], [3, 4]]);
    expect(cellsOf(r)).toEqual([1, 2, 3, 4]);
    expect(toMatrix(mapCells(r, (v) => (v as number) * 10))).toEqual([[10, 20], [30, 40]]);
    expect(toMatrix(transpose(fromRow([1, 2, 3])))).toEqual([[1], [2], [3]]);
  });

  it('detects vectors', () => {
    expect(isVector(fromRow([1, 2]))).toBe(true);
    expect(isVector(fromRows([[1, 2], [3, 4]]))).toBe(false);
  });
});
