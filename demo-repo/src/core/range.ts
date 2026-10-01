import { RangeValue, type Scalar, type Value } from './value';

/**
 * Helpers for 2D values. Array literals such as {1,2;3,4} evaluate to a RangeValue;
 * these helpers let functions treat scalars and ranges uniformly.
 */

/** Wraps a scalar in a 1x1 range; returns ranges unchanged. */
export function toRange(value: Value): RangeValue {
  return value instanceof RangeValue ? value : new RangeValue([[value]]);
}

/** [height, width] of a value (a scalar is 1x1). */
export function dimensions(value: Value): [number, number] {
  return value instanceof RangeValue ? [value.height, value.width] : [1, 1];
}

/** All cells in row-major order (a scalar gives a one-element list). */
export function cellsOf(value: Value): Scalar[] {
  return value instanceof RangeValue ? value.rows.flat() : [value];
}

/** Builds a range from a list of rows. */
export function fromRows(rows: Scalar[][]): RangeValue {
  return new RangeValue(rows);
}

/** Builds a single-column range (one value per row). */
export function fromColumn(values: readonly Scalar[]): RangeValue {
  return new RangeValue(values.map((v) => [v]));
}

/** Builds a single-row range. */
export function fromRow(values: readonly Scalar[]): RangeValue {
  return new RangeValue([[...values]]);
}

/** Applies `fn` to every cell, keeping the shape. */
export function mapCells(range: RangeValue, fn: (cell: Scalar, row: number, col: number) => Scalar): RangeValue {
  return new RangeValue(range.rows.map((cells, r) => cells.map((cell, c) => fn(cell, r, c))));
}

/** Swaps rows and columns. */
export function transpose(range: RangeValue): RangeValue {
  const rows: Scalar[][] = [];
  for (let c = 0; c < range.width; c++) {
    rows.push(range.rows.map((cells) => cells[c]));
  }
  return new RangeValue(rows);
}

/** True when the value is a single row or a single column. */
export function isVector(value: Value): boolean {
  const [height, width] = dimensions(value);
  return height === 1 || width === 1;
}
