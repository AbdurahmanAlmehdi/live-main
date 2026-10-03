import type { Task } from '@livemain/protocol';
import { h, reducedMotion, setText } from '../dom.js';
import { categoryLabel, categoryOf, categoryRank, colLetter, fakeValue, taskLabel } from '../format.js';
import type { RunModel } from '../model.js';
import type { CellState } from '../types.js';

export interface GridCounts {
  pending: number;
  landed: number;
  green: number;
  failing: number;
  broken: number;
  total: number;
}

interface Cell {
  task: Task;
  el: HTMLElement;
  value: HTMLElement | null;
  state: CellState | null;
}

const STATE_TEXT: Record<CellState, string> = {
  pending: 'not implemented',
  landed: 'landed, waiting for CI on main',
  green: 'tests pass on main',
  failing: 'landed, tests still failing',
  broken: 'regressed: was green, now red',
};

/**
 * The hero: one spreadsheet cell per task, grouped by category into row bands, with column
 * letters across the top. Cells show #NAME? until their test file passes in the latest CI run.
 */
export class GridView {
  readonly el: HTMLElement;
  private readonly cells: Cell[] = [];
  private readonly groups: { counter: HTMLElement; cells: Cell[]; box: HTMLElement; fillers: HTMLElement[] }[] = [];
  private readonly letters: HTMLElement;
  private cols = 0;
  private lastRev = -1;
  private lastScopeRev = -1;
  counts: GridCounts = { pending: 0, landed: 0, green: 0, failing: 0, broken: 0, total: 0 };

  constructor(
    private readonly model: RunModel,
    private readonly full: boolean,
  ) {
    this.letters = h('div', { class: 'grid-letters', 'aria-hidden': 'true' });
    const body = h('div', { class: 'grid-body' });
    const byCat = new Map<string, Task[]>();
    for (const t of model.tasks) {
      const c = categoryOf(t);
      const list = byCat.get(c) ?? [];
      list.push(t);
      byCat.set(c, list);
    }
    const cats = [...byCat.keys()].sort((a, b) => categoryRank(a) - categoryRank(b) || a.localeCompare(b));
    for (const cat of cats) {
      const tasks = byCat.get(cat)!;
      const counter = h('span', { class: 'band-count' });
      const cellsEl = h('div', { class: 'band-cells', role: 'list' });
      const group: Cell[] = [];
      for (const task of tasks) {
        const name = taskLabel(task.id);
        const value = full ? h('span', { class: 'cell-value' }) : null;
        const el = h(
          'div',
          { class: `cell k-${task.kind}`, role: 'listitem', 'data-task': task.id },
          full ? h('span', { class: 'cell-name' }, name) : null,
          value,
        );
        el.addEventListener('animationend', () => el.classList.remove('flip'));
        const cell: Cell = { task, el, value, state: null };
        group.push(cell);
        this.cells.push(cell);
        cellsEl.append(el);
      }
      this.groups.push({ counter, cells: group, box: cellsEl, fillers: [] });
      body.append(h('div', { class: 'band' }, h('div', { class: 'band-head' }, h('span', { class: 'band-name' }, categoryLabel(cat)), counter), cellsEl));
    }
    this.el = h('section', { class: `grid ${full ? 'grid-full' : 'grid-compact'}`, 'aria-label': 'Spreadsheet of functions' }, this.letters, body);
    const ro = new ResizeObserver(() => this.layout());
    ro.observe(this.el);
  }

  /** Fixed column count per width so the letter header lines up with the cells. */
  private layout(): void {
    const width = this.el.clientWidth;
    if (width === 0) return;
    const style = getComputedStyle(this.el);
    const head = parseFloat(style.getPropertyValue('--band-head')) || 0;
    const min = parseFloat(style.getPropertyValue('--cell-min')) || 18;
    const cols = Math.max(4, Math.floor((width - head) / min));
    if (cols === this.cols) return;
    this.cols = cols;
    this.el.style.setProperty('--cols', String(cols));
    this.letters.replaceChildren(h('span', { class: 'corner' }), ...Array.from({ length: cols }, (_, i) => h('span', null, colLetter(i))));
    // Pad each band's last row with empty cells so the sheet's gridlines stay continuous.
    for (const g of this.groups) {
      for (const f of g.fillers) f.remove();
      const visible = g.cells.filter((c) => !c.el.hidden).length;
      g.box.closest('.band')?.toggleAttribute('hidden', visible === 0);
      const rest = (cols - (visible % cols)) % cols;
      g.fillers = Array.from({ length: rest }, () => h('div', { class: 'cell filler', 'aria-hidden': 'true' }));
      g.box.append(...g.fillers);
    }
  }

  update(): void {
    if (this.model.rev === this.lastRev) return;
    const first = this.lastRev === -1;
    this.lastRev = this.model.rev;
    if (this.model.scopeRev !== this.lastScopeRev) {
      // The run's task subset is known: show only its cells, then re-pad the bands.
      this.lastScopeRev = this.model.scopeRev;
      for (const c of this.cells) c.el.hidden = !this.model.inScope(c.task);
      this.cols = 0;
      this.layout();
    }
    const counts: GridCounts = { pending: 0, landed: 0, green: 0, failing: 0, broken: 0, total: 0 };
    const animate = !first && !reducedMotion();
    for (const c of this.cells) {
      if (c.el.hidden) continue;
      counts.total++;
      const s = this.model.cellState(c.task);
      counts[s]++;
      if (s === c.state) continue;
      const prev = c.state;
      c.state = s;
      c.el.className = `cell k-${c.task.kind} c-${s}`;
      if (animate && prev !== null) {
        // Restart the flash even if a previous one is still running.
        void c.el.offsetWidth;
        c.el.classList.add('flip');
      }
      c.el.title = `${taskLabel(c.task.id)}: ${STATE_TEXT[s]}${c.task.kind !== 'leaf' ? ` (${c.task.kind})` : ''}`;
      if (c.value) setText(c.value, this.display(c.task, s));
    }
    for (const g of this.groups) {
      const shown = g.cells.filter((c) => !c.el.hidden);
      const green = shown.filter((c) => c.state === 'green').length;
      setText(g.counter, `${green}/${shown.length}`);
    }
    this.counts = counts;
  }

  private display(t: Task, s: CellState): string {
    const name = taskLabel(t.id);
    switch (s) {
      case 'pending':
        return '#NAME?';
      case 'landed':
        return `=${t.kind === 'leaf' ? name : 'fx'}()`;
      case 'green':
        return t.kind === 'leaf' ? fakeValue(name, categoryOf(t)) : 'OK';
      case 'failing':
        return '#VALUE!';
      case 'broken':
        return '#REF!';
    }
  }
}
