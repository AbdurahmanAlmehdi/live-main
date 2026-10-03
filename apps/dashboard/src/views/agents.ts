import { h, setText } from '../dom.js';
import { agentLabel, clock, taskLabel } from '../format.js';
import type { AgentView, RunModel } from '../model.js';

const LAG_CAP = 12;
/** An interrupt counts as "recent" for this long (run time). */
const RECENT_MS = 25_000;

function behind(model: RunModel, a: AgentView): number {
  return a.pin === null ? 0 : Math.max(0, model.head - a.pin);
}

/** Compact strip for the side-by-side view: one bar per active agent, height = versions behind head. */
export class LagStripView {
  readonly el: HTMLElement;
  private readonly bars: HTMLElement;
  private readonly caption: HTMLElement;
  private lastRev = -1;

  constructor(private readonly model: RunModel) {
    this.bars = h('div', { class: 'lag-bars', 'aria-hidden': 'true' });
    this.caption = h('span', { class: 'lag-caption' });
    this.el = h('section', { class: 'lag', 'aria-label': 'Agent pins behind head' }, h('div', { class: 'lag-head' }, h('h3', null, 'Agents behind head'), this.caption), this.bars);
  }

  update(now: number): void {
    if (this.model.rev === this.lastRev) return;
    this.lastRev = this.model.rev;
    const agents = this.model.activeAgents();
    const lags = agents.map((a) => behind(this.model, a));
    const sorted = [...lags].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)]! : 0;
    setText(this.caption, agents.length ? `${agents.length} active, median ${median} ${median === 1 ? 'version' : 'versions'} behind` : 'No active agents');
    this.bars.replaceChildren(
      ...agents.map((a, i) => {
        const lag = lags[i]!;
        const interrupted = a.notices.some((n) => n.severity === 'interrupt' && now - n.at < RECENT_MS);
        return h(
          'span',
          { class: `lag-bar${lag === 0 ? ' at-head' : ''}${interrupted ? ' has-interrupt' : ''}`, style: `--lag:${Math.min(lag, LAG_CAP) / LAG_CAP}`, title: `${agentLabel(a.agentId)} on ${taskLabel(a.taskId)}: pin v${a.pin ?? '?'}, ${lag} behind` },
          h('span', { class: 'lag-n' }, lag > 0 ? String(lag) : ''),
        );
      }),
    );
  }
}

/** Full table for the focus view. */
export class AgentsView {
  readonly el: HTMLElement;
  private readonly body: HTMLElement;
  private readonly count: HTMLElement;
  private lastRev = -1;

  constructor(private readonly model: RunModel) {
    this.body = h('tbody');
    this.count = h('span', { class: 'panel-sub' });
    this.el = h(
      'section',
      { class: 'panel agents', 'aria-label': 'Agents and overlays' },
      h('header', { class: 'panel-head' }, h('h3', null, 'Agents and overlays'), this.count),
      h(
        'table',
        { class: 'agents-table' },
        h(
          'thead',
          null,
          h('tr', null, h('th', null, 'Agent'), h('th', null, 'Task'), h('th', { class: 'num' }, 'Pin'), h('th', null, 'Behind head'), h('th', { class: 'num' }, 'Reads'), h('th', { class: 'num' }, 'Writes'), h('th', null, 'Recent notices')),
        ),
        this.body,
      ),
    );
  }

  update(now: number): void {
    if (this.model.rev === this.lastRev) return;
    this.lastRev = this.model.rev;
    const agents = this.model.activeAgents();
    setText(this.count, `${agents.length} active, head v${this.model.head}`);
    if (agents.length === 0) {
      this.body.replaceChildren(h('tr', null, h('td', { colspan: 7, class: 'empty' }, this.model.finishedAt ? 'Run finished. Every agent has handed in.' : 'Waiting for agents to start tasks.')));
      return;
    }
    this.body.replaceChildren(
      ...agents.map((a) => {
        const lag = behind(this.model, a);
        const recent = a.notices.filter((n) => n.severity !== 'ignore').slice(-3).reverse();
        return h(
          'tr',
          { class: recent.some((n) => n.severity === 'interrupt' && now - n.at < RECENT_MS) ? 'row-interrupt' : '' },
          h('td', { class: 'agent-id' }, agentLabel(a.agentId), h('span', { class: 'agent-age' }, clock((Math.max(now, this.model.lastAt) - a.startedAt) / 1000))),
          h('td', { class: 'agent-task' }, taskLabel(a.taskId), a.rejections + a.rebases > 0 ? h('span', { class: 'agent-retry' }, `${a.rejections + a.rebases} retries`) : null),
          h('td', { class: 'num' }, a.pin === null ? '?' : `v${a.pin}`),
          h('td', null, h('span', { class: `lag-meter${lag === 0 ? ' at-head' : ''}`, style: `--lag:${Math.min(lag, LAG_CAP) / LAG_CAP}` }), h('span', { class: 'lag-label' }, lag === 0 ? 'at head' : String(lag))),
          h('td', { class: 'num' }, a.readSet ?? '?'),
          h('td', { class: 'num' }, a.writeSet ?? '?'),
          h(
            'td',
            { class: 'agent-notices' },
            ...recent.map((n) => h('span', { class: `chip sev-${n.severity}`, title: `${n.kind}: ${n.path} in v${n.version}\n${n.reason}` }, `${n.severity === 'interrupt' ? 'Interrupt' : 'Review'} ${shortName(n.path)}`)),
          ),
        );
      }),
    );
  }
}

function shortName(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.ts$/, '');
}
