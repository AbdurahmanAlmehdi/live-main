import { describe, expect, it } from 'vitest';
import { agentName, ago, modelName, workerText } from '../src/lib/format';
import { highlightLine } from '../src/lib/highlight';

describe('highlight', () => {
  it('colours keywords, strings, types, calls and comments, and escapes HTML', () => {
    const html = highlightLine(`export const a: Foo<T> = call('x<y>'); // note`);
    expect(html).toContain('<span class="tk-k">export</span>');
    expect(html).toContain('<span class="tk-t">Foo</span>');
    expect(html).toContain('<span class="tk-f">call</span>');
    expect(html).toContain(`<span class="tk-s">'x&lt;y&gt;'</span>`);
    expect(html).toContain('<span class="tk-c">// note</span>');
    expect(html).not.toMatch(/<y>/);
  });
  it('leaves non-code untouched but escaped', () => {
    expect(highlightLine('a < b & c', 'text')).toBe('a &lt; b &amp; c');
  });
});

describe('format', () => {
  it('names agents by slot and models by their product names', () => {
    expect(agentName('smur6grq0f2e-a12-fn-ACOTH-32')).toBe('a12');
    expect(modelName('claude-haiku-4-5-20251001')).toBe('Claude Haiku 4.5');
    expect(workerText({ kind: 'model', provider: 'openrouter', model: 'org/model' })).toBe('OpenRouter · org/model');
    expect(workerText({ kind: 'scripted' })).toBe('Replay · reference solution');
  });
  it('relative times', () => {
    expect(ago(1000, 3000)).toBe('now');
    expect(ago(0 + 1, 40_001)).toBe('40 s');
    expect(ago(1, 120_001)).toBe('2 min');
  });
});
