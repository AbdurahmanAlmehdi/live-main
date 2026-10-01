// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('COMPLEX', () => {
  it('=COMPLEX(3, 4)', async () => {
    expect(await evaluate('=COMPLEX(3, 4)')).toBe('3+4i');
  });
  it('=COMPLEX(3, 4, "j")', async () => {
    expect(await evaluate('=COMPLEX(3, 4, "j")')).toBe('3+4j');
  });
  it('=COMPLEX(0, 1)', async () => {
    expect(await evaluate('=COMPLEX(0, 1)')).toBe('i');
  });
  it('=COMPLEX(0, -1)', async () => {
    expect(await evaluate('=COMPLEX(0, -1)')).toBe('-i');
  });
  it('=COMPLEX(2, 0)', async () => {
    expect(await evaluate('=COMPLEX(2, 0)')).toBe('2');
  });
  it('=COMPLEX(0, 0)', async () => {
    expect(await evaluate('=COMPLEX(0, 0)')).toBe('0');
  });
  it('=COMPLEX(1.5, -2.25)', async () => {
    expect(await evaluate('=COMPLEX(1.5, -2.25)')).toBe('1.5-2.25i');
  });
  it('=COMPLEX(3, 4, "I")', async () => {
    expect(await evaluate('=COMPLEX(3, 4, "I")')).toMatchObject({ code: '#VALUE!' });
  });
  it('=COMPLEX(3, 4, "k")', async () => {
    expect(await evaluate('=COMPLEX(3, 4, "k")')).toMatchObject({ code: '#VALUE!' });
  });
  it('=COMPLEX("x", 1)', async () => {
    expect(await evaluate('=COMPLEX("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
