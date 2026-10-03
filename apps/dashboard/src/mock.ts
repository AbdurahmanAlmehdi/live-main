/**
 * Mock mode (?mock=1): a synthetic task bank and a discrete-event simulation of the same swarm
 * under the three strategies, emitting protocol-exact RunEvents on a shared simulated clock.
 * It exists so the dashboard can be developed and filmed without the backend. The numbers are
 * plausible, not measured: the real benchmark replaces all of this.
 */
import type { Notice, NoticeKind, OverlayState, RunEvent, Severity, StrategyName, Task, TaskBank } from '@livemain/protocol';
import type { RunListing, RunSource, SeqEvent, SourceHandlers } from './types.js';

// ---------------------------------------------------------------- deterministic randomness

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619);
  return (x >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- task bank

const FUNCTIONS: Record<string, string> = {
  math: 'ABS ACOS ACOSH ASIN ASINH ATAN ATAN2 ATANH CEILING COMBIN COMBINA COS COSH DEGREES EVEN EXP FACT FACTDOUBLE FLOOR GCD INT LCM LN LOG LOG10 MOD MROUND MULTINOMIAL ODD PI POWER PRODUCT QUOTIENT RADIANS ROUND ROUNDDOWN ROUNDUP SEC SIGN SIN SINH SQRT SQRTPI SUBTOTAL SUM SUMIF SUMIFS SUMPRODUCT SUMSQ SUMX2MY2 SUMX2PY2 SUMXMY2 TAN TANH TRUNC',
  statistical:
    'AVEDEV AVERAGE AVERAGEA AVERAGEIF AVERAGEIFS CORREL COUNT COUNTA COUNTBLANK COUNTIF COUNTIFS COVARIANCE.P COVARIANCE.S DEVSQ FORECAST GEOMEAN HARMEAN INTERCEPT KURT LARGE MAX MAXA MAXIFS MEDIAN MIN MINA MINIFS MODE.SNGL PEARSON PERCENTILE.INC PERCENTRANK.INC QUARTILE.INC RANK.EQ RSQ SKEW SLOPE SMALL STANDARDIZE STDEV.P STDEV.S STDEVA TRIMMEAN VAR.P VAR.S VARA',
  text: 'CHAR CLEAN CODE CONCAT CONCATENATE DOLLAR EXACT FIND FIXED LEFT LEN LOWER MID NUMBERVALUE PROPER REPLACE REPT RIGHT SEARCH SUBSTITUTE T TEXT TEXTJOIN TRIM UNICHAR UNICODE UPPER VALUE',
  logical: 'AND FALSE IF IFERROR IFNA IFS NOT OR SWITCH TRUE XOR',
  lookup: 'ADDRESS CHOOSE COLUMN COLUMNS HLOOKUP INDEX LOOKUP MATCH ROW ROWS TRANSPOSE VLOOKUP XLOOKUP XMATCH',
  date: 'DATE DATEDIF DATEVALUE DAY DAYS DAYS360 EDATE EOMONTH HOUR ISOWEEKNUM MINUTE MONTH NETWORKDAYS SECOND TIME TIMEVALUE WEEKDAY WEEKNUM WORKDAY YEAR YEARFRAC',
  financial: 'ACCRINT CUMIPMT CUMPRINC DB DDB DOLLARDE DOLLARFR EFFECT FV FVSCHEDULE IPMT IRR ISPMT MIRR NOMINAL NPER NPV PDURATION PMT PPMT PV RATE RRI SLN SYD TBILLEQ TBILLPRICE TBILLYIELD XNPV',
  information: 'ERROR.TYPE ISBLANK ISERR ISERROR ISEVEN ISLOGICAL ISNA ISNONTEXT ISNUMBER ISODD ISTEXT N NA TYPE',
  engineering: 'BIN2DEC BIN2HEX BIN2OCT BITAND BITLSHIFT BITOR BITRSHIFT BITXOR COMPLEX DEC2BIN DEC2HEX DEC2OCT DELTA ERF ERFC GESTEP HEX2BIN HEX2DEC HEX2OCT IMABS IMAGINARY IMREAL OCT2BIN OCT2DEC OCT2HEX',
};

/** helper name → categories (or function-name pattern) whose leaves depend on it */
const HELPERS: [string, RegExp][] = [
  ['criteria', /IFS?$/],
  ['criteria-wildcards', /^(COUNTIFS|SUMIFS|AVERAGEIFS|MAXIFS|MINIFS)$/],
  ['date-serial', /^(DATE|DAY|DAYS|EDATE|EOMONTH|MONTH|YEAR|WEEKDAY|WEEKNUM|ISOWEEKNUM)$/],
  ['day-count', /^(DAYS360|YEARFRAC|ACCRINT|TBILL.*|DATEDIF)$/],
  ['business-days', /^(NETWORKDAYS|WORKDAY)$/],
  ['time-parse', /^(TIME|TIMEVALUE|HOUR|MINUTE|SECOND|DATEVALUE)$/],
  ['text-format', /^(TEXT|FIXED|DOLLAR)$/],
  ['string-search', /^(FIND|SEARCH|SUBSTITUTE|REPLACE)$/],
  ['unicode', /^(CHAR|CODE|UNICHAR|UNICODE|CLEAN)$/],
  ['moments', /^(AVEDEV|DEVSQ|KURT|SKEW|STDEV.*|VAR.*|STANDARDIZE)$/],
  ['percentile', /^(PERCENTILE.INC|PERCENTRANK.INC|QUARTILE.INC|MEDIAN|TRIMMEAN)$/],
  ['ranking', /^(LARGE|SMALL|RANK.EQ|MODE.SNGL)$/],
  ['regression', /^(CORREL|PEARSON|RSQ|SLOPE|INTERCEPT|FORECAST|COVARIANCE.*)$/],
  ['lookup-match', /^(MATCH|XMATCH|VLOOKUP|HLOOKUP|XLOOKUP|LOOKUP)$/],
  ['range-shape', /^(INDEX|ROW|ROWS|COLUMN|COLUMNS|TRANSPOSE|ADDRESS)$/],
  ['annuity', /^(PMT|IPMT|PPMT|FV|PV|NPER|RATE|CUMIPMT|CUMPRINC|ISPMT)$/],
  ['cashflow', /^(NPV|XNPV|IRR|MIRR)$/],
  ['depreciation', /^(DB|DDB|SLN|SYD)$/],
  ['base-convert', /2(BIN|DEC|HEX|OCT)$/],
  ['bitwise', /^BIT/],
  ['complex', /^(COMPLEX|IM.*)$/],
  ['rounding', /^(ROUND.*|MROUND|CEILING|FLOOR|TRUNC|INT|EVEN|ODD)$/],
  ['combinatorics', /^(COMBIN|COMBINA|FACT|FACTDOUBLE|MULTINOMIAL|GCD|LCM)$/],
  ['trig', /^(A?(SIN|COS|TAN)H?|ATAN2|SEC|DEGREES|RADIANS)$/],
  ['error-propagate', /^(IFERROR|IFNA|ISERR|ISERROR|ISNA|ERROR.TYPE|NA)$/],
  ['type-of', /^(TYPE|N|T|ISTEXT|ISNONTEXT|ISNUMBER|ISLOGICAL|ISBLANK)$/],
  ['array-broadcast', /^(SUMPRODUCT|SUMX2MY2|SUMX2PY2|SUMXMY2|SUMSQ|PRODUCT)$/],
  ['counting', /^(COUNT|COUNTA|COUNTBLANK)$/],
  ['concat', /^(CONCAT|CONCATENATE|TEXTJOIN|REPT)$/],
  ['number-parse', /^(VALUE|NUMBERVALUE)$/],
];

const CHANGE_ORDERS: [string, string, string, number][] = [
  ['co-flatten-opts', 'flattenArgs takes a required options object', 'src/core/args.ts', 0.18],
  ['co-error-codes', 'FormulaError carries a typed detail field', 'src/core/errors.ts', 0.3],
  ['co-coerce-locale', 'toNumber accepts a locale for decimal separators', 'src/core/coerce.ts', 0.42],
  ['co-range-iter', 'RangeValue exposes cells() instead of rows', 'src/core/range.ts', 0.55],
  ['co-eval-context', 'FormulaFunction receives an EvalContext', 'src/core/types.ts', 0.66],
  ['co-empty-cells', 'Empty cells become an explicit Empty value', 'src/core/value.ts', 0.78],
];

const TRAPS: [string, string, string, RegExp][] = [
  ['trap-blank-is-zero', 'Treat blank strings as zero in toNumber', 'coerce', /^(SUM|AVERAGE|COUNT|MAX|MIN|PRODUCT)$/],
  ['trap-bool-text', 'Booleans render as lowercase text', 'coerce', /^(CONCAT|TEXTJOIN|T|EXACT)$/],
  ['trap-criteria-case', 'Criteria matching becomes case sensitive', 'criteria', /^(COUNTIF|SUMIF|AVERAGEIF)$/],
  ['trap-epoch-1904', 'Date serials honor the 1904 epoch flag', 'date-serial', /^(DAYS|EDATE|YEAR|MONTH)$/],
  ['trap-round-half-even', 'Rounding switches to banker’s rounding', 'rounding', /^(ROUND|MROUND|FIXED|DOLLAR)$/],
  ['trap-match-exact', 'Lookup matching defaults to exact', 'lookup-match', /^(VLOOKUP|HLOOKUP|LOOKUP)$/],
  ['trap-error-first', 'Errors propagate before type checks', 'error-propagate', /^(IFERROR|ISERROR|ISERR)$/],
  ['trap-stdev-sample', 'Moment helper defaults to sample variance', 'moments', /^(STDEV.P|VAR.P|AVEDEV)$/],
];

export function mockBank(): TaskBank {
  const tasks: Task[] = [];
  const helperIdFor = (name: string): string[] => HELPERS.filter(([, re]) => re.test(name)).map(([h]) => `helper-${h}`);
  for (const [co, title, file, releaseAt] of CHANGE_ORDERS) {
    tasks.push({ id: co, kind: 'change-order', title, prompt: title, tests: [`tests/core/${co}.test.ts`], dependsOn: [], category: 'core', expectedFiles: [file], releaseAt, contract: true });
  }
  for (const [h] of HELPERS) {
    tasks.push({ id: `helper-${h}`, kind: 'helper', title: `Implement the ${h} helper`, prompt: '', tests: [`tests/helpers/${h}.test.ts`], dependsOn: [], category: 'helpers', expectedFiles: [`src/helpers/${h}.ts`] });
  }
  const leaves: Task[] = [];
  for (const [cat, names] of Object.entries(FUNCTIONS)) {
    for (const name of names.split(' ')) {
      leaves.push({
        id: `fn-${name}`,
        kind: 'leaf',
        title: `Implement ${name}`,
        prompt: '',
        tests: [`tests/functions/${name}.test.ts`],
        dependsOn: helperIdFor(name),
        category: cat,
        expectedFiles: [`src/functions/${cat}/${name}.ts`, 'src/core/registry.ts'],
      });
    }
  }
  tasks.push(...leaves);
  for (const [id, title, helper, re] of TRAPS) {
    const breaks = leaves.filter((l) => re.test(l.id.slice(3))).map((l) => l.id);
    tasks.push({ id, kind: 'trap', title, prompt: title, tests: [`tests/helpers/${id}.test.ts`], dependsOn: [], category: 'helpers', expectedFiles: [`src/helpers/${helper}.ts`], breaks });
  }
  return { version: 1, tasks };
}

// ---------------------------------------------------------------- simulation

const AGENTS = 16;
const RELEASE_HORIZON = 820; // sim seconds the change-order release fractions are scaled to
const CI_SECONDS = 4;
const CORE_READS = ['src/eval/evaluate.ts', 'src/eval/parser.ts', 'src/eval/lexer.ts', 'src/core/value.ts', 'src/core/errors.ts', 'src/core/coerce.ts', 'src/core/types.ts', 'src/core/registry.ts'];
const REGISTRY = 'src/core/registry.ts';

interface SimAgent {
  slot: number;
  id: string;
  task: Task;
  pin: number;
  startT: number;
  reads: string[];
  writes: string[];
  caught: boolean;
  pushTries: number;
  /** a sloppy conflict resolution will drop this task's registry line when it lands */
  clobbers: string | null;
  /** missed a call site of a change order during conflict resolution */
  missedCo: boolean;
  busyUntil: number;
}

interface Landed {
  v: number;
  taskId: string | null;
  paths: string[];
}

class Sim {
  readonly out: SeqEvent[] = [];
  private seq = 0;
  t = 0;
  private q: { t: number; n: number; fn: () => void }[] = [];
  private n = 0;
  private readonly rnd: () => number;

  private head = 1;
  private readonly versions: Landed[] = [{ v: 1, taskId: null, paths: [] }];
  private readonly status = new Map<string, 'waiting' | 'running' | 'landed'>();
  private readonly released = new Set<string>();
  private readonly landedAt = new Map<string, number>();
  private readonly broken = new Set<string>();
  /** landed tasks whose own tests never went green (missed a change-order call site) */
  private readonly redOnLand = new Set<string>();
  private readonly fixes: string[] = [];
  private readonly fixing = new Set<string>();
  private readonly agents = new Map<number, SimAgent>();
  private readonly free: number[] = [];
  private readonly order: Task[];
  private readonly byId = new Map<string, Task>();
  private queue: SimAgent[] = [];
  private queueBusy = false;
  private promoteFreeAt = 0;
  private ciBusy = false;
  private lastCi = 0;
  private attempt = 0;
  private finished = false;

  constructor(
    readonly runId: string,
    readonly strategy: StrategyName,
    tasks: Task[],
    private readonly t0: number,
  ) {
    this.rnd = mulberry32(Math.floor(hash(strategy) * 1e9));
    // Same task order for every strategy: contracts and helpers early, leaves shuffled.
    const shuffle = mulberry32(7);
    const leaves = tasks.filter((t) => t.kind === 'leaf').map((t) => ({ t, k: shuffle() })).sort((a, b) => a.k - b.k).map((x) => x.t);
    const traps = tasks.filter((t) => t.kind === 'trap');
    // Traps are spread through the run so they land after some of their dependents.
    const ordered: Task[] = [...tasks.filter((t) => t.kind === 'helper')];
    leaves.forEach((l, i) => {
      ordered.push(l);
      if (i % 28 === 27 && traps.length > 0) ordered.push(traps.shift()!);
    });
    ordered.push(...traps, ...tasks.filter((t) => t.kind === 'change-order'));
    this.order = ordered;
    for (const t of tasks) {
      this.byId.set(t.id, t);
      this.status.set(t.id, 'waiting');
    }
    for (let s = AGENTS - 1; s >= 0; s--) this.free.push(s);

    this.emit({ type: 'run.started', runId, strategy, agents: AGENTS, tasks: tasks.length, at: this.at() });
    this.emit({ type: 'landed', version: 1, sha: sha(runId, 1), agentId: 'seed', taskId: null, paths: [], merged: 0, at: this.at() });
    this.schedule(1.5, () => this.runCi());
    for (const t of tasks) {
      if (t.kind === 'change-order') this.schedule((t.releaseAt ?? 0.5) * RELEASE_HORIZON, () => this.release(t));
    }
    this.schedule(0.4, () => this.fill());
  }

  // -------------------------------------------------------------- engine

  at(): number {
    return this.t0 + Math.round(this.t * 1000);
  }

  private emit(event: RunEvent): void {
    this.out.push({ seq: ++this.seq, event });
  }

  schedule(dt: number, fn: () => void): void {
    const item = { t: this.t + dt, n: this.n++, fn };
    let lo = 0;
    let hi = this.q.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const m = this.q[mid]!;
      if (m.t < item.t || (m.t === item.t && m.n < item.n)) lo = mid + 1;
      else hi = mid;
    }
    this.q.splice(lo, 0, item);
  }

  runUntil(T: number): void {
    while (this.q.length > 0 && this.q[0]!.t <= T) {
      const item = this.q.shift()!;
      this.t = item.t;
      item.fn();
    }
    this.t = Math.max(this.t, T);
  }

  overlays(): OverlayState[] {
    return [...this.agents.values()].map((a) => ({
      agentId: a.id,
      taskId: a.task.id,
      strategy: this.strategy,
      workcell: `wc-${a.slot % 4}`,
      pin: a.pin,
      readSet: a.reads,
      writeSet: this.t - a.startT > 8 ? a.writes : [],
      status: 'active' as const,
      createdAt: this.t0 + a.startT * 1000,
      updatedAt: this.at(),
    }));
  }

  private r(lo: number, hi: number): number {
    return lo + this.rnd() * (hi - lo);
  }

  // -------------------------------------------------------------- scheduling

  private release(t: Task): void {
    this.released.add(t.id);
    this.emit({ type: 'change-order.released', taskId: t.id, at: this.at() });
    this.fill();
  }

  private ready(t: Task): boolean {
    if (this.status.get(t.id) !== 'waiting' || this.fixing.has(t.id)) return false;
    if (t.kind === 'change-order' && !this.released.has(t.id)) return false;
    return t.dependsOn.every((d) => this.status.get(d) === 'landed');
  }

  private nextTask(): Task | undefined {
    while (this.fixes.length > 0) {
      const fix = this.fixes.shift()!;
      if (this.status.get(fix) === 'waiting') return this.byId.get(fix);
    }
    const co = this.order.find((t) => t.kind === 'change-order' && this.ready(t));
    if (co) return co;
    return this.order.find((t) => this.ready(t));
  }

  private fill(): void {
    while (this.free.length > 0) {
      const task = this.nextTask();
      if (!task) break;
      this.start(task, this.free.pop()!);
    }
    this.maybeFinish();
  }

  private start(task: Task, slot: number): void {
    this.status.set(task.id, 'running');
    const id = `${this.runId}-a${slot}-${task.id}-${this.attempt++}`;
    const reads = [...CORE_READS, ...task.dependsOn.map((d) => `src/helpers/${d.slice(7)}.ts`), ...task.tests];
    if (hash(task.id + 'args') < 0.6) reads.push('src/core/args.ts');
    if (hash(task.id + 'range') < 0.4) reads.push('src/core/range.ts');
    if (task.kind === 'trap' || task.kind === 'helper') reads.push(...(task.expectedFiles ?? []));
    const a: SimAgent = {
      slot,
      id,
      task,
      pin: this.head,
      startT: this.t,
      reads,
      writes: [...(task.expectedFiles ?? [])],
      caught: false,
      pushTries: 0,
      clobbers: null,
      missedCo: false,
      busyUntil: 0,
    };
    this.agents.set(slot, a);
    this.emit({ type: 'task.started', agentId: id, taskId: task.id, at: this.at() });
    const fixing = this.fixing.has(task.id);
    const base = fixing ? this.r(10, 18) : workSeconds(task);
    if (this.strategy === 'live-main') this.scheduleCheckpoints(a, base);
    this.schedule(base, () => this.submit(a));
  }

  private finish(a: SimAgent, outcome: 'landed' | 'failed' | 'gave-up'): void {
    const secs = this.t - a.startT;
    this.emit({
      type: 'agent.usage',
      agentId: a.id,
      taskId: a.task.id,
      inputTokens: Math.round(secs * this.r(780, 980)),
      outputTokens: Math.round(secs * this.r(48, 70)),
      toolCalls: Math.max(3, Math.round(secs / 4)),
      at: this.at(),
    });
    this.emit({ type: 'task.finished', agentId: a.id, taskId: a.task.id, outcome, at: this.at() });
    this.agents.delete(a.slot);
    this.free.push(a.slot);
    if (outcome !== 'landed') {
      this.status.set(a.task.id, 'waiting');
      if (this.fixing.has(a.task.id)) this.fixes.push(a.task.id);
    }
    this.schedule(0.4, () => this.fill());
  }

  // -------------------------------------------------------------- live main

  private scheduleCheckpoints(a: SimAgent, total: number): void {
    for (let s = 10; s < total - 2; s += 11) {
      this.schedule(s, () => {
        if (this.agents.get(a.slot) !== a) return;
        this.checkpoint(a);
      });
    }
  }

  private checkpoint(a: SimAgent): void {
    if (a.pin === this.head) return;
    const from = a.pin;
    const touched = this.delta(from).filter((p) => a.reads.includes(p) && p !== REGISTRY);
    this.emit({ type: 'checkpoint', agentId: a.id, from, to: this.head, notices: touched.length, at: this.at() });
    a.pin = this.head;
  }

  private delta(from: number): string[] {
    const out = new Set<string>();
    for (const v of this.versions) if (v.v > from) for (const p of v.paths) out.add(p);
    return [...out];
  }

  private notice(a: SimAgent, kind: NoticeKind, severity: Severity, path: string, reason: string, extra: Partial<Notice> = {}): void {
    const n: Notice = { id: `n${this.seq + 1}`, agentId: a.id, kind, severity, path, version: this.head, reason, at: this.at(), ...extra };
    this.emit({ type: 'notice', notice: n });
  }

  private submitLive(a: SimAgent): void {
    const task = a.task;
    if (task.kind === 'trap' && !a.caught) {
      a.caught = true;
      const dependents = (task.breaks ?? []).filter((d) => this.status.get(d) === 'landed').map((d) => this.byId.get(d)!.tests[0]!);
      if (dependents.length > 0) {
        this.notice(a, 'impact', 'interrupt', task.expectedFiles![0]!, `would break ${dependents.length} dependent test files`);
        this.emit({ type: 'promotion.rejected', agentId: a.id, reason: 'impact-failed', paths: dependents.slice(0, 4), at: this.at() });
        this.schedule(this.r(14, 22), () => this.submit(a));
        return;
      }
    }
    const stale = this.delta(a.pin).filter((p) => p !== REGISTRY && (a.reads.includes(p) || a.writes.includes(p)));
    if (stale.length > 0) {
      this.emit({ type: 'promotion.rejected', agentId: a.id, reason: 'stale', paths: stale.slice(0, 3), at: this.at() });
      this.checkpoint(a);
      this.schedule(this.r(4, 8), () => this.submit(a));
      return;
    }
    // Promotions are serialized in the coordinator but cheap: no retest when nothing read moved.
    const when = Math.max(this.t, this.promoteFreeAt) + this.r(0.6, 1.3);
    this.promoteFreeAt = when;
    this.schedule(when - this.t, () => {
      const merged = this.versions.some((v) => v.v > a.pin && v.paths.includes(REGISTRY)) && a.writes.includes(REGISTRY) ? 1 : 0;
      this.land(a, merged);
      this.fanOut(a);
      this.finish(a, 'landed');
    });
  }

  /** Notify active agents whose read sets intersect what just landed. */
  private fanOut(from: SimAgent): void {
    const v = this.versions[this.versions.length - 1]!;
    for (const other of this.agents.values()) {
      if (other === from) continue;
      if (v.paths.includes(REGISTRY) && other.writes.includes(REGISTRY) && this.rnd() < 0.08) {
        this.notice(other, 'write-write', 'review', REGISTRY, 'concurrent registration merged', { mergeResult: 'merged', mergeMethod: 'mergiraf' });
      }
      const hit = v.paths.filter((p) => p !== REGISTRY && other.reads.includes(p));
      if (hit.length === 0) continue;
      const p = hit[0]!;
      if (from.task.kind === 'change-order') {
        this.notice(other, 'change-order', 'interrupt', p, from.task.title);
        this.schedule(this.r(1, 3), () => {
          if (this.agents.get(other.slot) === other) this.checkpoint(other);
        });
      } else {
        const sig = this.rnd() < 0.3;
        this.notice(other, 'read-write', sig ? 'interrupt' : 'review', p, sig ? 'exported signature changed' : 'function body changed');
        if (sig) {
          this.schedule(this.r(1, 3), () => {
            if (this.agents.get(other.slot) === other) this.checkpoint(other);
          });
        }
      }
    }
  }

  // -------------------------------------------------------------- PR flow

  private submitPr(a: SimAgent): void {
    if (a.task.kind === 'change-order') this.queue.unshift(a);
    else this.queue.push(a);
    this.pumpQueue();
  }

  private pumpQueue(): void {
    if (this.queueBusy) return;
    const a = this.queue.shift();
    if (!a) return;
    this.queueBusy = true;
    const moved = this.versions.filter((v) => v.v > a.pin);
    const registryMoved = moved.some((v) => v.paths.includes(REGISTRY)) && a.writes.includes(REGISTRY);
    const coMoved = moved.some((v) => v.taskId !== null && this.byId.get(v.taskId)?.kind === 'change-order');
    if ((registryMoved && this.rnd() < 0.55) || (coMoved && this.rnd() < 0.5)) {
      // Textual conflict: the queue kicks the PR out; the agent rebases and resolves.
      this.emit({ type: 'promotion.rejected', agentId: a.id, reason: 'needs-rebase', paths: coMoved ? [REGISTRY, 'src/core/args.ts'] : [REGISTRY], at: this.at() });
      this.queueBusy = false;
      this.schedule(this.r(7, 13), () => {
        this.emit({ type: 'rebase', agentId: a.id, conflicts: (registryMoved ? 1 : 0) + (coMoved ? 2 : 0), at: this.at() });
        a.pin = this.head;
        this.schedule(this.r(3, 6), () => this.submitPr(a));
      });
      this.schedule(0.2, () => this.pumpQueue());
      return;
    }
    // Clean merge: the queue runs the full suite on the merge result before merging.
    this.schedule(CI_SECONDS + this.r(0.5, 1.5), () => {
      this.queueBusy = false;
      const trapHits = a.task.kind === 'trap' && !a.caught ? (a.task.breaks ?? []).filter((d) => this.status.get(d) === 'landed') : [];
      if (trapHits.length > 0) {
        a.caught = true;
        this.emit({ type: 'promotion.rejected', agentId: a.id, reason: 'impact-failed', paths: trapHits.slice(0, 4).map((d) => this.byId.get(d)!.tests[0]!), at: this.at() });
        this.schedule(this.r(16, 26), () => this.submitPr(a));
      } else if (coMoved && hash(a.id) < 0.35) {
        this.emit({ type: 'promotion.rejected', agentId: a.id, reason: 'rejected', paths: [a.task.tests[0]!], at: this.at() });
        this.schedule(this.r(12, 20), () => {
          this.emit({ type: 'rebase', agentId: a.id, conflicts: 0, at: this.at() });
          a.pin = this.head;
          this.submitPr(a);
        });
      } else {
        this.land(a, 0);
        this.finish(a, 'landed');
      }
      this.pumpQueue();
    });
  }

  // -------------------------------------------------------------- push to branch

  private submitPush(a: SimAgent): void {
    if (this.head === a.pin) {
      this.land(a, 0);
      this.finish(a, 'landed');
      return;
    }
    a.pushTries++;
    this.emit({ type: 'promotion.rejected', agentId: a.id, reason: 'push-rejected', paths: [], at: this.at() });
    const moved = this.versions.filter((v) => v.v > a.pin);
    const registry = moved.some((v) => v.paths.includes(REGISTRY)) && a.writes.includes(REGISTRY) && this.rnd() < 0.6 ? 1 : 0;
    const coVersion = moved.find((v) => v.taskId !== null && this.byId.get(v.taskId)?.kind === 'change-order');
    const coConflicts = coVersion && a.task.kind !== 'change-order' ? 2 : 0;
    const conflicts = registry + coConflicts;
    if (registry && this.rnd() < 0.06) {
      // Resolution keeps "ours" and drops a neighbour's registry line.
      const victim = [...moved].reverse().find((v) => v.taskId?.startsWith('fn-'));
      if (victim?.taskId) a.clobbers = victim.taskId;
    }
    if (coConflicts && this.rnd() < 0.3) a.missedCo = true;
    if (a.pushTries > 4 && this.rnd() < 0.25) {
      this.schedule(this.r(2, 4), () => this.finish(a, 'gave-up'));
      return;
    }
    this.schedule(this.r(3, 5) + conflicts * this.r(4, 7), () => {
      this.emit({ type: 'rebase', agentId: a.id, conflicts, at: this.at() });
      a.pin = this.head;
      const retest = this.rnd() < 0.5 ? this.r(3, 6) : 0.5;
      this.schedule(retest, () => this.submitPush(a));
    });
  }

  // -------------------------------------------------------------- shared

  private submit(a: SimAgent): void {
    if (this.agents.get(a.slot) !== a) return;
    if (this.strategy === 'live-main') this.submitLive(a);
    else if (this.strategy === 'pr-flow') this.submitPr(a);
    else this.submitPush(a);
  }

  private land(a: SimAgent, merged: number): void {
    const v = ++this.head;
    const task = a.task;
    let paths = [...(task.expectedFiles ?? [])];
    if (task.kind === 'change-order') {
      // The codemod rewrites every landed call site.
      const sites = [...this.landedAt.keys()].filter((id) => id.startsWith('fn-') && hash(id + task.id) < 0.35).map((id) => this.byId.get(id)!.expectedFiles![0]!);
      paths = [...paths, ...sites];
    }
    this.versions.push({ v, taskId: task.id, paths });
    this.status.set(task.id, 'landed');
    this.landedAt.set(task.id, v);
    this.fixing.delete(task.id);
    this.broken.delete(task.id);
    this.redOnLand.delete(task.id);
    if (a.missedCo) this.redOnLand.add(task.id);
    if (a.clobbers && this.status.get(a.clobbers) === 'landed') this.broken.add(a.clobbers);
    if (task.kind === 'trap' && !a.caught) for (const d of task.breaks ?? []) if (this.status.get(d) === 'landed') this.broken.add(d);
    this.emit({ type: 'landed', version: v, sha: sha(this.runId, v), agentId: a.id, taskId: task.id, paths, merged, at: this.at() });
    this.runCi();
  }

  private runCi(): void {
    if (this.ciBusy || this.lastCi === this.head) return;
    this.ciBusy = true;
    const v = this.head;
    const failing: string[] = [];
    let total = 18; // core tests that always pass
    for (const t of this.byId.values()) {
      const landed = this.status.get(t.id) === 'landed';
      if (t.kind === 'change-order' && !landed) continue;
      total += t.tests.length;
      if (!landed || this.broken.has(t.id) || this.redOnLand.has(t.id)) failing.push(...t.tests);
    }
    this.schedule(CI_SECONDS + this.r(0, 1.5), () => {
      this.ciBusy = false;
      this.lastCi = v;
      this.emit({ type: 'ci', version: v, sha: sha(this.runId, v), passed: total - failing.length, failed: failing.length, failing, at: this.at() });
      // Baselines only learn about breakage here, after it landed: someone is sent to fix it.
      for (const id of [...this.broken, ...this.redOnLand]) {
        if (this.fixing.has(id)) continue;
        this.fixing.add(id);
        this.status.set(id, 'waiting');
        this.schedule(this.r(6, 14), () => {
          this.fixes.push(id);
          this.fill();
        });
      }
      if (this.head !== this.lastCi) this.schedule(0.2, () => this.runCi());
      this.maybeFinish();
    });
  }

  private maybeFinish(): void {
    if (this.finished || this.agents.size > 0 || this.ciBusy || this.lastCi !== this.head) return;
    if (this.fixing.size > 0) return;
    for (const s of this.status.values()) if (s !== 'landed') return;
    this.finished = true;
    this.emit({ type: 'run.finished', runId: this.runId, at: this.at() });
  }
}

function workSeconds(t: Task): number {
  const base = 26 + hash(t.id) * 38;
  if (t.kind === 'helper') return base + 14;
  if (t.kind === 'change-order') return base + 30;
  if (t.kind === 'trap') return base + 10;
  return base;
}

function sha(runId: string, v: number): string {
  let s = '';
  for (let i = 0; i < 5; i++) s += Math.floor(hash(`${runId}:${v}:${i}`) * 0xffffffff).toString(16).padStart(8, '0');
  return s;
}

// ---------------------------------------------------------------- source

export interface MockClock {
  /** sim seconds since the race started */
  simSeconds(): number;
  t0: number;
}

export function mockClock(speed: number, fastForward: number): MockClock {
  const wall0 = performance.now();
  return { t0: Date.now() - fastForward * 1000, simSeconds: () => fastForward + ((performance.now() - wall0) / 1000) * speed };
}

export const MOCK_STRATEGIES: StrategyName[] = ['live-main', 'pr-flow', 'push-to-branch'];

export function mockRuns(): RunListing[] {
  return MOCK_STRATEGIES.map((s, i) => ({ runId: `mock-${s}`, strategy: s, createdAt: i }));
}

export class MockSource implements RunSource {
  private timer: number | null = null;
  private sent = 0;
  private readonly sim: Sim;

  constructor(
    readonly runId: string,
    strategy: StrategyName,
    bank: TaskBank,
    private readonly clockSrc: MockClock,
  ) {
    this.sim = new Sim(runId, strategy, bank.tasks, clockSrc.t0);
  }

  now(): number {
    return this.clockSrc.t0 + this.clockSrc.simSeconds() * 1000;
  }

  connect(h: SourceHandlers): void {
    h.status('mock');
    const tick = () => {
      this.sim.runUntil(this.clockSrc.simSeconds());
      if (this.sent < this.sim.out.length) {
        h.events(this.sim.out.slice(this.sent));
        this.sent = this.sim.out.length;
      }
      h.overlays(this.sim.overlays());
    };
    tick();
    this.timer = window.setInterval(tick, 250);
  }

  close(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
  }
}
