import { h } from '../dom.js';
import { agentLabel, clock } from '../format.js';
import type { FeedItem, RunModel } from '../model.js';

const TONE_LABEL: Record<FeedItem['tone'], string> = {
  interrupt: 'Interrupt',
  review: 'Review',
  ignore: 'Info',
  caught: 'Caught',
  reject: 'Rejected',
  rebase: 'Rebase',
  release: 'Contract',
  regress: 'Regression',
  green: 'All green',
};

/** Notices, rejections, rebases and regressions, newest first. */
export class FeedView {
  readonly el: HTMLElement;
  private readonly list: HTMLElement;
  private lastId = 0;

  constructor(
    private readonly model: RunModel,
    private readonly max: number,
  ) {
    this.list = h('ol', { class: 'feed-list' });
    this.el = h('section', { class: 'panel feed', 'aria-label': 'Notifications' }, h('header', { class: 'panel-head' }, h('h3', null, 'Notices and rejections')), this.list);
  }

  update(): void {
    const items = this.model.feed.filter((f) => f.id > this.lastId);
    if (items.length === 0) return;
    const firstPaint = this.lastId === 0;
    this.lastId = items[items.length - 1]!.id;
    const t0 = this.model.startedAt ?? 0;
    for (const f of items.slice(-this.max)) {
      const row = h(
        'li',
        { class: `feed-row tone-${f.tone}${firstPaint ? '' : ' enter'}` },
        h('span', { class: 'feed-tag' }, TONE_LABEL[f.tone]),
        h('span', { class: 'feed-title' }, f.title),
        h('span', { class: 'feed-meta' }, f.agentId ? `${agentLabel(f.agentId)} ` : '', clock((f.at - t0) / 1000)),
        h('span', { class: 'feed-detail' }, f.detail),
      );
      this.list.prepend(row);
    }
    while (this.list.children.length > this.max) this.list.lastElementChild?.remove();
  }
}
