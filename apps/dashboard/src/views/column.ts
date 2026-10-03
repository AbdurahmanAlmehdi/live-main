import { h, setText, toggle } from '../dom.js';
import { clock, STRATEGY_BLURB, STRATEGY_LABEL } from '../format.js';
import type { RunModel } from '../model.js';
import type { ConnState } from '../types.js';
import { AgentsView, LagStripView } from './agents.js';
import { FeedView } from './feed.js';
import { GridView } from './grid.js';
import { TimelineView } from './timeline.js';

const CONN_LABEL: Record<ConnState, string> = {
  connecting: 'Connecting',
  live: 'Live',
  polling: 'Polling',
  offline: 'Offline, retrying',
  mock: 'Simulated',
};

/** Run header: strategy, clock, stacked progress bar, counts and the formula bar. */
class RunHeader {
  readonly el: HTMLElement;
  private readonly clockEl: HTMLElement;
  private readonly headEl: HTMLElement;
  private readonly conn: HTMLElement;
  private readonly connText: HTMLElement;
  private readonly bar: Record<'green' | 'landed' | 'failing' | 'broken', HTMLElement>;
  private readonly stats: Record<'green' | 'landed' | 'broken' | 'pending', HTMLElement>;
  private readonly fxName: HTMLElement;
  private readonly fxText: HTMLElement;
  private readonly fx: HTMLElement;
  private lastFx = '';

  constructor(
    private readonly model: RunModel,
    onFocus: (() => void) | null,
  ) {
    const s = model.strategy;
    this.clockEl = h('span', { class: 'rh-clock', title: 'Elapsed run time' });
    this.headEl = h('span', { class: 'rh-headv', title: 'Current version of main' });
    this.connText = h('span', { class: 'conn-text' });
    this.conn = h('span', { class: 'conn' }, this.connText);
    const name = onFocus
      ? h('button', { class: 'rh-name', type: 'button', title: 'Focus on this run', onclick: onFocus }, STRATEGY_LABEL[s])
      : h('span', { class: 'rh-name' }, STRATEGY_LABEL[s]);
    this.bar = {
      green: h('span', { class: 'seg seg-green' }),
      landed: h('span', { class: 'seg seg-landed' }),
      failing: h('span', { class: 'seg seg-failing' }),
      broken: h('span', { class: 'seg seg-broken' }),
    };
    this.stats = {
      green: h('b', { class: 'n-green' }),
      landed: h('b', { class: 'n-landed' }),
      broken: h('b', { class: 'n-broken' }),
      pending: h('b', { class: 'n-pending' }),
    };
    this.fxName = h('span', { class: 'fx-name' });
    this.fxText = h('span', { class: 'fx-text' });
    this.fx = h('div', { class: 'fx', 'aria-live': 'polite' }, h('span', { class: 'fx-label', 'aria-hidden': 'true' }, 'fx'), this.fxName, this.fxText);
    this.el = h(
      'header',
      { class: 'run-head' },
      h('div', { class: 'rh-top' }, h('h2', null, name), this.conn, h('span', { class: 'grow' }), this.headEl, this.clockEl),
      h('p', { class: 'rh-blurb' }, STRATEGY_BLURB[s], h('span', { class: 'rh-runid' }, model.runId)),
      h('div', { class: 'progress', 'aria-hidden': 'true' }, this.bar.green, this.bar.landed, this.bar.failing, this.bar.broken),
      h(
        'p',
        { class: 'rh-stats' },
        this.stats.green,
        ' green ',
        h('span', { class: 'sep' }),
        this.stats.landed,
        ' awaiting CI ',
        h('span', { class: 'sep' }),
        this.stats.broken,
        ' broken ',
        h('span', { class: 'sep' }),
        this.stats.pending,
        ' to go',
      ),
      this.fx,
    );
  }

  update(now: number, counts: GridView['counts'], conn: ConnState): void {
    const m = this.model;
    setText(this.connText, CONN_LABEL[conn]);
    this.conn.title = CONN_LABEL[conn];
    this.conn.className = `conn conn-${conn}`;
    setText(this.headEl, `v${m.head}`);
    const green = m.allGreenAt !== null && m.startedAt !== null;
    toggle(this.el, 'is-green', green && m.ci?.failed === 0);
    setText(this.clockEl, green && m.ci?.failed === 0 ? `All green ${clock((m.allGreenAt! - m.startedAt!) / 1000)}` : clock(m.elapsed(now)));
    const total = Math.max(1, counts.total);
    for (const k of ['green', 'landed', 'failing', 'broken'] as const) this.bar[k].style.width = `${(counts[k] / total) * 100}%`;
    setText(this.stats.green, String(counts.green));
    setText(this.stats.landed, String(counts.landed));
    setText(this.stats.broken, String(counts.broken + counts.failing));
    setText(this.stats.pending, String(counts.pending));
    const a = m.lastAction;
    const key = a ? `${a.fx}|${a.text}` : '';
    if (a && key !== this.lastFx) {
      this.lastFx = key;
      setText(this.fxName, a.fx);
      setText(this.fxText, a.text);
      this.fx.className = `fx tone-${a.tone}`;
    } else if (!a) {
      setText(this.fxName, '');
      setText(this.fxText, m.startedAt ? 'Waiting for the first landing' : 'Waiting for the run to start');
    }
  }
}

export interface Column {
  readonly el: HTMLElement;
  update(now: number, conn: ConnState): void;
}

/** One strategy in the side-by-side race. */
export class RaceColumn implements Column {
  readonly el: HTMLElement;
  private readonly header: RunHeader;
  private readonly grid: GridView;
  private readonly lag: LagStripView;
  private readonly timeline: TimelineView;
  private readonly feed: FeedView;

  constructor(model: RunModel, onFocus: () => void) {
    this.header = new RunHeader(model, onFocus);
    this.grid = new GridView(model, false);
    this.lag = new LagStripView(model);
    this.timeline = new TimelineView(model, 6);
    this.feed = new FeedView(model, 5);
    this.el = h('article', { class: `race-col s-${model.strategy}` }, this.header.el, this.grid.el, this.lag.el, this.timeline.el, this.feed.el);
  }

  update(now: number, conn: ConnState): void {
    this.grid.update();
    this.header.update(now, this.grid.counts, conn);
    this.lag.update(now);
    this.timeline.update(now);
    this.feed.update();
  }
}

/** One run in detail: the named grid, agents with overlays, timeline and notices. */
export class FocusColumn implements Column {
  readonly el: HTMLElement;
  private readonly header: RunHeader;
  private readonly grid: GridView;
  private readonly agents: AgentsView;
  private readonly timeline: TimelineView;
  private readonly feed: FeedView;

  constructor(model: RunModel) {
    this.header = new RunHeader(model, null);
    this.grid = new GridView(model, true);
    this.agents = new AgentsView(model);
    this.timeline = new TimelineView(model, 14);
    this.feed = new FeedView(model, 14);
    this.el = h(
      'article',
      { class: `focus s-${model.strategy}` },
      h('div', { class: 'focus-main' }, this.header.el, this.grid.el),
      h('div', { class: 'focus-side' }, this.agents.el, this.timeline.el, this.feed.el),
    );
  }

  update(now: number, conn: ConnState): void {
    this.grid.update();
    this.header.update(now, this.grid.counts, conn);
    this.agents.update(now);
    this.timeline.update(now);
    this.feed.update();
  }
}
