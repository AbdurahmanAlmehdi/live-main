import { describe, expect, it } from 'vitest';
import { err, errorFromCode, firstError, isError, isErrorCode, NotImplementedError } from '../../src/core/errors';
import { ERROR_CODES } from '../../src/core/value';

describe('errors', () => {
  it('maps every code to its singleton', () => {
    for (const code of ERROR_CODES) expect(errorFromCode(code).code).toBe(code);
    expect(errorFromCode('#N/A')).toBe(err.na);
  });

  it('recognises errors', () => {
    expect(isError(err.value)).toBe(true);
    expect(isError('#VALUE!')).toBe(false);
    expect(isErrorCode(err.num, '#NUM!')).toBe(true);
    expect(isErrorCode(err.num, '#N/A')).toBe(false);
  });

  it('finds the first error', () => {
    expect(firstError(1, 'a', err.div0, err.na)).toBe(err.div0);
    expect(firstError(1, 2)).toBeUndefined();
  });

  it('describes missing implementations', () => {
    expect(new NotImplementedError('foo').message).toBe('foo is not implemented yet');
  });
});
