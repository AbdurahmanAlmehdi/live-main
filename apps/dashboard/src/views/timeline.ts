import { h, setText, svg } from '../dom.js';
import { agentLabel, clock, taskLabel } from '../format.js';
import type { Landing, RunModel } from '../model.js';

const BUCKETS = 36;

/** Live main as a stream of versions, newest first, with a landings-per-minute sparkline. */
export class TimelineView {
  readonly el: HTMLElement;
  private readonly list: HTMLElement;
  private readonly rate: HTMLElement;
  private readonly total: HTMLElement;
  private readonly spark: SVGSVGElement;
  private readonly area: SVGPathElement;
  private readonly line: SVGPathElement;
  private shown = 0;
  private lastRev = -1;

  constructor(
    private readonly model: RunModel,
    private readonly max: number,
  ) {
    this.rate = h('span', { class: 'tl-rate' });
    this.total = h('span', { class: 'tl-total' });
    this.area = svg('path', { class: 'spark-area' });
    this.line = svg('path', { class: 'spark-line' });
    this.spark = svg('svg', { class: 'spark', viewBox: `0 0 ${BUCKETS} 20`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    this.spark.append(this.area, this.line);
    this.list = h('ol', { class: 'tl-list', 'aria-live': 'off' });
    this.el = h(
      'section',
      { class: 'panel timeline', 'aria-label': 'Live main timeline' },
      h('header', { class: 'panel-head' }, h('h3', null, 'Main'), this.total, h('span', { class: 'grow' }), this.spark, this.rate),
      this.list,
    );
  }

  update(now: number): void {
    if (this.model.rev === this.lastRev) return;
    this.lastRev = this.model.rev;
    const m = this.model;
    setText(this.total, `v${m.head}`);
    this.drawSpark(now);

    const fresh = m.totalLandings - this.shown;
    if (fresh <= 0) return;
    const items = m.landings.slice(-Math.min(fresh, this.max));
    const firstPaint = this.shown === 0;
    this.shown = m.totalLandings;
    for (const l of items) {
      const row = this.row(l);
      if (!firstPaint) row.classList.add('enter');
      this.list.prepend(row);
    }
    while (this.list.children.length > this.max) this.list.lastElementChild?.remove();
  }

  private row(l: Landing): HTMLElement {
    const t0 = this.model.startedAt ?? l.at;
    const files = l.paths.filter((p) => !p.endsWith('registry.ts'));
    const primary = files[0] ?? l.paths[0] ?? '';
    const more = l.paths.length - 1;
    return h(
      'li',
      { class: `tl-row${l.changeOrder ? ' is-co' : ''}` },
      h('span', { class: 'tl-v' }, `v${l.version}`),
      h('span', { class: 'tl-task' }, taskLabel(l.taskId) || 'external'),
      h('span', { class: 'tl-agent' }, agentLabel(l.agentId)),
      h('span', { class: 'tl-path', title: l.paths.join('\n') }, shortPath(primary), more > 0 ? h('span', { class: 'tl-more' }, ` +${more}`) : null),
      h(
        'span',
        { class: 'tl-badges' },
        l.changeOrder ? h('span', { class: 'badge badge-co' }, 'change order') : null,
        l.merged > 0 ? h('span', { class: 'badge badge-merge' }, 'auto-merged') : null,
      ),
      h('span', { class: 'tl-time' }, clock((l.at - t0) / 1000)),
    );
  }

  private drawSpark(now: number): void {
    const m = this.model;
    const t0 = m.startedAt;
    if (t0 === null || m.landings.length === 0) {
      setText(this.rate, '0.0/min');
      return;
    }
    const t1 = m.finishedAt ?? Math.max(now, m.lastAt);
    const span = Math.max(60_000, t1 - t0);
    const width = span / BUCKETS;
    const counts = new Array<number>(BUCKETS).fill(0);
    for (const l of m.landings) {
      const i = Math.min(BUCKETS - 1, Math.max(0, Math.floor((l.at - t0) / width)));
      counts[i]!++;
    }
    const peak = Math.max(1, ...counts);
    const pts = counts.map((c, i) => [i + 0.5, 19 - (c / peak) * 17] as const);
    const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join('');
    this.line.setAttribute('d', d);
    this.area.setAttribute('d', `${d}L${BUCKETS - 0.5},20L0.5,20Z`);
    // Recent rate: landings in the last minute of the run.
    const recent = m.landings.filter((l) => l.at > t1 - 60_000).length;
    setText(this.rate, `${recent}/min`);
  }
}

function shortPath(p: string): string {
  return p.replace(/^src\//, '');
}
