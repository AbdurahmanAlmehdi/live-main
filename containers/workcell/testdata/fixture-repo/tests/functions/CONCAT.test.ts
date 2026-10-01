import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('CONCAT', () => {
  it('joins text', async () => {
    expect(await evaluate('=CONCAT("a","b")')).toBe('ab');
  });
  it('renders booleans', async () => {
    expect(await evaluate('=CONCAT(TRUE,1)')).toBe('TRUE1');
  });
});
