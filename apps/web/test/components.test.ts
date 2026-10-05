import type { FileView } from '@livemain/protocol';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import CodeView from '../src/components/lm/CodeView.vue';
import StatusChip from '../src/components/lm/StatusChip.vue';

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)', component: { template: '<div />' } }] });

describe('StatusChip', () => {
  it('always pairs the icon with a label (never colour alone)', () => {
    const w = mount(StatusChip, { props: { state: 'ready' } });
    expect(w.text()).toBe('ready to land');
    expect(w.find('svg').exists()).toBe(true);
    expect(w.attributes('data-state')).toBe('ready');
  });
});

describe('CodeView margin notes', () => {
  it('places a pending change beside the line it lands on and marks that line', async () => {
    const file: FileView = {
      path: 'src/core/registry.ts',
      version: 7,
      content: 'a\nb\n  // marker\n};\n',
      lines: 4,
      lastLanding: null,
      writers: [{ agentId: 's1-a3-fn-X-0', taskTitle: 'Implement X', state: 'working' }],
      readers: 2,
      notes: [
        {
          agentId: 's1-a3-fn-X-0',
          taskTitle: 'Implement X',
          state: 'working',
          worker: { kind: 'scripted' },
          class: 'additive',
          hunk: { header: '@@ -2,2 +2,3 @@', oldStart: 2, oldLines: 2, newStart: 2, newLines: 3, lines: [{ kind: 'ctx', old: 2, new: 2, text: 'b' }, { kind: 'add', old: null, new: 3, text: '  X: 1,' }, { kind: 'ctx', old: 3, new: 4, text: '  // marker' }] },
        },
      ],
    };
    const w = mount(CodeView, { props: { file, agentLink: (id: string) => `/agents/${id}` }, global: { plugins: [router] } });
    await new Promise((r) => setTimeout(r, 0));
    expect(w.findAll('.lm-code-row')).toHaveLength(4);
    const marked = w.findAll('.lm-code-row').map((r) => r.classes().includes('is-marked'));
    expect(marked).toEqual([false, false, true, false]);
    const note = w.find('.lm-note');
    expect(note.text()).toContain('a3');
    expect(note.text()).toContain('Implement X');
    expect(note.text()).toContain('lands at line 3');
    expect(note.attributes('style')).toContain('top: 44px');
  });
});
