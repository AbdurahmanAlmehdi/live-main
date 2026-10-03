import type { StrategyName, Task, TaskBank } from '@livemain/protocol';
import { h } from './dom.js';
import { STRATEGY_LABEL, strategyFromRunId } from './format.js';
import { mockBank, mockClock, mockRuns, MockSource, type MockClock } from './mock.js';
import { RunModel } from './model.js';
import { listRuns, LiveSource, loadTaskBank } from './source.js';
import type { ConnState, RunListing, RunSource } from './types.js';
import { FocusColumn, RaceColumn, type Column } from './views/column.js';
import { ScoreboardView } from './views/scoreboard.js';

const MAX_COLUMNS = 3;
const ORDER: StrategyName[] = ['live-main', 'pr-flow', 'push-to-branch'];

interface Session {
  model: RunModel;
  source: RunSource;
  conn: ConnState;
}

const params = new URLSearchParams(location.search);
const isMock = params.get('mock') === '1';
const app = document.getElementById('app')!;

let tasks: Task[] = [];
let bankError: string | null = null;
let runs: RunListing[] = [];
let selected: string[] = [];
let focus: string | null = params.get('focus');
let userPicked = params.has('runs');
let clockSrc: MockClock | null = null;
const sessions = new Map<string, Session>();
let columns: { session: Session; view: Column }[] = [];
let board: ScoreboardView | null = null;

function strategyOf(r: RunListing): StrategyName | undefined {
  return r.strategy ?? strategyFromRunId(r.runId);
}

/** Latest run of each strategy, in a fixed order; falls back to the newest runs. */
function defaultSelection(list: RunListing[]): string[] {
  const indexed = list.map((r, i) => ({ r, i }));
  const newest = (xs: typeof indexed) => xs.sort((a, b) => (b.r.createdAt ?? b.i) - (a.r.createdAt ?? a.i))[0]?.r.runId;
  const picks = ORDER.map((s) => newest(indexed.filter((x) => strategyOf(x.r) === s))).filter((x): x is string => !!x);
  if (picks.length > 0) return picks;
  return indexed.sort((a, b) => (b.r.createdAt ?? b.i) - (a.r.createdAt ?? a.i)).slice(0, MAX_COLUMNS).map((x) => x.r.runId);
}

function session(runId: string): Session {
  let s = sessions.get(runId);
  if (s) return s;
  const listing = runs.find((r) => r.runId === runId);
  const strategy = listing ? strategyOf(listing) : strategyFromRunId(runId);
  const model = new RunModel(runId, tasks, strategy);
  const source: RunSource = isMock && clockSrc ? new MockSource(runId, strategy ?? 'live-main', { version: 1, tasks }, clockSrc) : new LiveSource(runId);
  const created: Session = { model, source, conn: 'connecting' };
  s = created;
  sessions.set(runId, created);
  source.connect({
    events: (batch) => created.model.apply(batch),
    overlays: (list) => created.model.setOverlays(list),
    status: (st) => (created.conn = st),
  });
  return created;
}

function syncUrl(): void {
  const q = new URLSearchParams(location.search);
  if (userPicked) q.set('runs', selected.join(','));
  else q.delete('runs');
  if (focus) q.set('focus', focus);
  else q.delete('focus');
  history.replaceState(null, '', `${location.pathname}?${q.toString()}`.replace(/\?$/, ''));
}

function releaseUnused(): void {
  if (isMock) return; // the simulated race keeps running in the background
  for (const [id, s] of sessions) {
    if (selected.includes(id) || id === focus) continue;
    s.source.close();
    sessions.delete(id);
  }
}

// ---------------------------------------------------------------- layout

function logo(): SVGSVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', '0 0 30 30');
  el.setAttribute('class', 'logo');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<rect x="1" y="1" width="8" height="28" rx="1.5" class="lg-a"/><rect x="11" y="1" width="8" height="28" rx="1.5" class="lg-b"/><rect x="21" y="1" width="8" height="28" rx="1.5" class="lg-c"/>';
  return el;
}

function picker(index: number): HTMLElement {
  const sel = h('select', { class: 'picker', 'aria-label': `Run in column ${index + 1}` });
  sel.append(h('option', { value: '' }, index === 0 ? 'Choose a run' : 'Empty column'));
  for (const r of runs) {
    const s = strategyOf(r);
    const opt = h('option', { value: r.runId }, `${s ? STRATEGY_LABEL[s] : 'Run'}: ${r.runId}`);
    if (selected[index] === r.runId) opt.selected = true;
    sel.append(opt);
  }
  sel.addEventListener('change', () => {
    const next = [...selected];
    next[index] = sel.value;
    selected = next.filter((x, i, all) => !!x && all.indexOf(x) === i).slice(0, MAX_COLUMNS);
    userPicked = true;
    if (focus && !selected.includes(focus)) focus = null;
    render();
  });
  return sel;
}

function topbar(): HTMLElement {
  const fnCount = tasks.filter((t) => t.kind === 'leaf').length;
  const subtitle = tasks.length > 0 ? `Agent swarms implementing ${fnCount} spreadsheet functions, one shared repo, three ways to merge` : 'Agent swarms, one shared repo, three ways to merge';
  const pickers = h('div', { class: 'pickers' }, ...Array.from({ length: MAX_COLUMNS }, (_, i) => picker(i)));
  const back = focus
    ? h(
        'button',
        {
          class: 'btn',
          type: 'button',
          onclick: () => {
            focus = null;
            render();
          },
        },
        'Back to the race',
      )
    : null;
  return h(
    'header',
    { class: 'topbar' },
    h('div', { class: 'brand' }, logo(), h('div', null, h('h1', null, 'Live Main'), h('p', null, subtitle))),
    h('span', { class: 'grow' }),
    isMock ? h('span', { class: 'pill', title: 'Synthesized events, not a real benchmark run' }, 'Simulated data') : null,
    back,
    runs.length > 0 ? pickers : null,
  );
}

function legend(): HTMLElement {
  const item = (cls: string, sample: string, text: string) => h('li', null, h('span', { class: `cell lg-cell c-${cls}` }, h('span', { class: 'cell-value' }, sample)), text);
  return h(
    'ul',
    { class: 'legend', 'aria-label': 'Cell states' },
    item('pending', '#NAME?', 'Not implemented'),
    item('landed', '=FN()', 'Landed, CI pending'),
    item('green', '42', 'Passing on main'),
    item('failing', '#VALUE!', 'Landed but failing'),
    item('broken', '#REF!', 'Regressed after green'),
    h('li', { class: 'legend-kinds' }, h('span', { class: 'mark k-helper' }), 'Helper', h('span', { class: 'mark k-change-order' }), 'Change order', h('span', { class: 'mark k-trap' }), 'Trap'),
  );
}

function emptyState(): HTMLElement {
  return h(
    'section',
    { class: 'empty-state' },
    h('h2', null, 'No runs yet'),
    h('p', null, 'Start a benchmark and its runs show up here within a few seconds.'),
    h('pre', null, 'pnpm --filter @livemain/local livemain compare --tasks 300 --agents 16'),
    h('p', null, 'Or preview the dashboard with a simulated race: ', h('a', { href: '?mock=1' }, 'open mock mode'), '.'),
  );
}

function render(): void {
  syncUrl();
  releaseUnused();
  const parts: HTMLElement[] = [topbar()];
  if (bankError) parts.push(h('p', { class: 'banner' }, bankError));
  columns = [];
  board = null;
  if (selected.length === 0) {
    parts.push(emptyState());
    app.replaceChildren(...parts);
    return;
  }
  parts.push(legend());
  if (focus) {
    const s = session(focus);
    const view = new FocusColumn(s.model);
    columns.push({ session: s, view });
    parts.push(h('main', { class: 'layout-focus' }, view.el));
  } else {
    const race = h('main', { class: 'race', style: `--n:${selected.length}` });
    for (const id of selected) {
      const s = session(id);
      const view = new RaceColumn(s.model, () => {
        focus = id;
        render();
      });
      columns.push({ session: s, view });
      race.append(view.el);
    }
    parts.push(race);
  }
  board = new ScoreboardView(selected.map((id) => session(id).model));
  parts.push(board.el);
  app.replaceChildren(...parts);
  tick();
}

// ---------------------------------------------------------------- loop

const TICK_MS = 150;

function tick(): void {
  for (const c of columns) c.view.update(c.session.source.now(), c.session.conn);
  board?.update();
}

async function refreshRuns(): Promise<void> {
  try {
    const next = await listRuns();
    const changed = next.map((r) => r.runId).join() !== runs.map((r) => r.runId).join();
    runs = next;
    if (!changed) return;
    if (!userPicked) selected = defaultSelection(runs);
    render();
  } catch {
    /* keep the last list; the per-run sources report their own connection state */
  }
}

async function boot(): Promise<void> {
  app.replaceChildren(h('p', { class: 'loading' }, 'Loading runs'));
  if (isMock) {
    const speed = Number(params.get('speed') ?? 6) || 6;
    const ff = Number(params.get('t') ?? 0) || 0;
    clockSrc = mockClock(speed, ff);
    const bank: TaskBank = mockBank();
    tasks = bank.tasks;
    runs = mockRuns();
  } else {
    try {
      tasks = (await loadTaskBank()).tasks;
    } catch (err) {
      bankError = `Task bank not available at /bench/tasks.json (${err instanceof Error ? err.message : String(err)}). The grid stays empty until the dashboard is rebuilt with bench/tasks.json present.`;
    }
    try {
      runs = await listRuns();
    } catch {
      runs = [];
    }
    window.setInterval(() => void refreshRuns(), 5000);
  }
  const fromUrl = (params.get('runs') ?? '').split(',').filter(Boolean);
  selected = (fromUrl.length > 0 ? fromUrl : defaultSelection(runs)).slice(0, MAX_COLUMNS);
  if (focus && !selected.includes(focus)) selected = [focus, ...selected].slice(0, MAX_COLUMNS);
  render();
  window.setInterval(tick, TICK_MS);
}

void boot();
