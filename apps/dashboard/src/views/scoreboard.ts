import { scoreboard, type RunMetrics } from '@livemain/swarm';
import { h } from '../dom.js';
import { clock, compact, STRATEGY_LABEL } from '../format.js';
import type { RunModel } from '../model.js';

type Better = 'lower' | 'higher' | null;

interface Row {
  name: string;
  hint: string;
  /** comparable value; null = no value yet (never wins) */
  value(m: RunMetrics, model: RunModel): number | null;
  show(m: RunMetrics, model: RunModel): string;
  better: Better;
}

const rejectedTotal = (m: RunMetrics) => Object.values(m.rejections).reduce((a, b) => a + b, 0);

const ROWS: Row[] = [
  {
    name: 'Time to all green',
    hint: 'Run start to the first CI run on main with zero failing test files',
    value: (m) => m.timeToAllGreenSeconds,
    show: (m, model) => (m.timeToAllGreenSeconds === null ? (model.finishedAt ? 'never' : 'not yet') : clock(m.timeToAllGreenSeconds)),
    better: 'lower',
  },
  {
    name: 'Tasks landed',
    hint: 'Tasks that reached main, out of the run’s task count',
    value: (m) => m.landed,
    show: (m) => `${m.landed} / ${m.tasks}`,
    better: 'higher',
  },
  {
    name: 'Throughput',
    hint: 'Landings per minute of wall time',
    value: (m) => m.throughputPerMinute,
    show: (m) => `${m.throughputPerMinute.toFixed(1)} / min`,
    better: 'higher',
  },
  {
    name: 'Wasted agent-minutes',
    hint: 'Rework after a rejected submit plus attempts that never landed',
    value: (m) => m.wastedAgentMinutes,
    show: (m) => `${m.wastedAgentMinutes.toFixed(0)} (${m.agentMinutes > 0 ? Math.round((m.wastedAgentMinutes / m.agentMinutes) * 100) : 0}%)`,
    better: 'lower',
  },
  { name: 'Rebases', hint: 'Branches replayed onto a newer main', value: (m) => m.rebases, show: (m) => String(m.rebases), better: 'lower' },
  { name: 'Conflicted files', hint: 'Files an agent had to resolve by hand during rebases', value: (m) => m.conflictFiles, show: (m) => String(m.conflictFiles), better: 'lower' },
  { name: 'Rejected submits', hint: 'Stale, needs-rebase, push-rejected and failed impact checks', value: rejectedTotal, show: (m) => String(rejectedTotal(m)), better: 'lower' },
  { name: 'Breakages caught before landing', hint: 'Impact tests that stopped a dependent from going red', value: (m) => m.breakagesCaught, show: (m) => String(m.breakagesCaught), better: 'higher' },
  { name: 'Breakages that landed', hint: 'Test files that went red on main after having been green', value: (m) => m.regressions, show: (m) => String(m.regressions), better: 'lower' },
  {
    name: 'Tokens per landed task',
    hint: 'Input plus output tokens across all agents, divided by tasks landed (total in brackets)',
    value: (m) => (m.landed > 0 ? (m.inputTokens + m.outputTokens) / m.landed : null),
    show: (m) => (m.landed > 0 ? `${compact((m.inputTokens + m.outputTokens) / m.landed)} (${compact(m.inputTokens + m.outputTokens)})` : '0'),
    better: 'lower',
  },
  { name: 'Interrupts / reviews', hint: 'Notices delivered to agents whose reads changed', value: () => null, show: (m) => `${m.notices.interrupt} / ${m.notices.review}`, better: null },
  { name: 'Auto-merged files', hint: 'Concurrent edits merged without the agent', value: () => null, show: (m) => String(m.autoMerged), better: null },
];

/** Metrics across the displayed runs, recomputed live, best value per row highlighted. */
export class ScoreboardView {
  readonly el: HTMLElement;
  private readonly table: HTMLTableElement;
  private readonly copyBtn: HTMLButtonElement;
  private sig = '';

  constructor(private readonly models: RunModel[]) {
    this.table = h('table', { class: 'score-table' });
    this.copyBtn = h('button', { class: 'btn btn-quiet', type: 'button' }, 'Copy as Markdown');
    this.copyBtn.addEventListener('click', () => void this.copy());
    this.el = h(
      'section',
      { class: 'panel scoreboard', 'aria-label': 'Scoreboard' },
      h('header', { class: 'panel-head' }, h('h3', null, 'Scoreboard'), h('span', { class: 'panel-sub' }, 'Best value per row is highlighted'), h('span', { class: 'grow' }), this.copyBtn),
      h('div', { class: 'score-scroll' }, this.table),
    );
  }

  private async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(scoreboard(this.models.map((m) => m.metrics())));
      this.copyBtn.textContent = 'Copied';
    } catch {
      this.copyBtn.textContent = 'Clipboard blocked';
    }
    window.setTimeout(() => (this.copyBtn.textContent = 'Copy as Markdown'), 1600);
  }

  update(): void {
    const sig = this.models.map((m) => `${m.runId}:${m.rev}`).join('|');
    if (sig === this.sig) return;
    this.sig = sig;
    const metrics = this.models.map((m) => m.metrics());
    const multi = this.models.length > 1;
    const head = h(
      'thead',
      null,
      h(
        'tr',
        null,
        h('th', { class: 'metric' }, 'Metric'),
        ...this.models.map((m) => h('th', { class: `run s-${m.strategy}` }, h('span', { class: 'swatch' }), STRATEGY_LABEL[m.strategy])),
      ),
    );
    const body = h(
      'tbody',
      null,
      ...ROWS.map((row) => {
        const values = metrics.map((m, i) => row.value(m, this.models[i]!));
        const win = multi ? winners(values, row.better) : new Set<number>();
        return h(
          'tr',
          null,
          h('th', { class: 'metric', scope: 'row', title: row.hint }, row.name),
          ...metrics.map((m, i) => h('td', { class: `val s-${this.models[i]!.strategy}${win.has(i) ? ' win' : ''}` }, row.show(m, this.models[i]!))),
        );
      }),
    );
    this.table.replaceChildren(head, body);
  }
}

function winners(values: (number | null)[], better: Better): Set<number> {
  const out = new Set<number>();
  if (!better) return out;
  const present = values.map((v, i) => [v, i] as const).filter((x): x is readonly [number, number] => x[0] !== null);
  if (present.length === 0) return out;
  const best = better === 'lower' ? Math.min(...present.map((p) => p[0])) : Math.max(...present.map((p) => p[0]));
  // A row where every run ties is not a win for anyone.
  if (present.length === values.length && present.every((p) => Math.abs(p[0] - best) < 1e-9)) return out;
  for (const [v, i] of present) if (Math.abs(v - best) < 1e-9) out.add(i);
  return out;
}
