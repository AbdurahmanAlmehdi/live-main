import { describe, expect, it } from 'vitest';
import { formatWithPattern } from '../../src/helpers/textFormat';

describe('formatWithPattern: numbers', () => {
  it('handles decimals, grouping and percent', () => {
    expect(formatWithPattern(1234.567, '0.00')).toBe('1234.57');
    expect(formatWithPattern(1234.567, '#,##0')).toBe('1,235');
    expect(formatWithPattern(0.256, '0.0%')).toBe('25.6%');
    expect(formatWithPattern(5, '000')).toBe('005');
    expect(formatWithPattern(1234.5, '$#,##0.00')).toBe('$1,234.50');
  });

  it('handles sections and scientific notation', () => {
    expect(formatWithPattern(-5, '0.00;(0.00)')).toBe('(5.00)');
    expect(formatWithPattern(-5, '0.00')).toBe('-5.00');
    expect(formatWithPattern(12345.678, '0.00E+00')).toBe('1.23E+04');
    expect(formatWithPattern(3.1, '#.##')).toBe('3.1');
  });
});

describe('formatWithPattern: dates and times', () => {
  it('formats dates', () => {
    expect(formatWithPattern(43845, 'yyyy-mm-dd')).toBe('2020-01-15');
    expect(formatWithPattern(43845, 'mmm d, yyyy')).toBe('Jan 15, 2020');
    expect(formatWithPattern(43845, 'dddd')).toBe('Wednesday');
  });

  it('formats times, with minutes after hours', () => {
    expect(formatWithPattern(0.75, 'hh:mm')).toBe('18:00');
    expect(formatWithPattern(0.75, 'h:mm AM/PM')).toBe('6:00 PM');
    expect(formatWithPattern(43845.5, 'm/d/yy h:mm')).toBe('1/15/20 12:00');
  });

  it('formats General', () => {
    expect(formatWithPattern(1234.5, 'General')).toBe('1234.5');
  });
});
