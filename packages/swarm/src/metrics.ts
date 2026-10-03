import type { RunEvent, StrategyName } from '@livemain/protocol';

export interface RunMetrics {
  runId: string;
  strategy: StrategyName | 'unknown';
  agents: number;
  tasks: number;
  wallSeconds: number;
  landed: number;
  failed: number;
  /** seconds from run start to the first CI run with zero failing test files (null if never) */
  timeToAllGreenSeconds: number | null;
  /** seconds from run start to the last landing */
  timeToLastLandingSeconds: number | null;
  agentMinutes: number;
  /** agent time spent after a rejected submit (rework) plus time of attempts that did not land */
  wastedAgentMinutes: number;
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
  rejections: Record<'stale' | 'impact-failed' | 'rejected' | 'needs-rebase' | 'push-rejected', number>;
  rebases: number;
  conflictFiles: number;
  checkpoints: number;
  notices: Record<'interrupt' | 'review' | 'ignore', number>;
  autoMerged: number;
  /** test files that went red on main after having been green (silent breakages that landed) */
  regressions: number;
  /** trap/dependent breakages stopped before landing (impact-test rejections) */
  breakagesCaught: number;
  finalCi: { passed: number; failed: number } | null;
  /** landings per minute over the run */
  throughputPerMinute: number;
  /** landings that needed no retry after their first submit (live-main: promoted without re-test) */
  cleanLandings: number;
  interrupts: number;
  falseInterrupts: number;
}

export function computeMetrics(events: RunEvent[]): RunMetrics {
  const started = events.find((e): e is Extract<RunEvent, { type: 'run.started' }> => e.type === 'run.started');
  const finished = [...events].reverse().find((e): e is Extract<RunEvent, { type: 'run.finished' }> => e.type === 'run.finished');
  const t0 = started?.at ?? events[0]?.['at' as never] ?? 0;
  const t1 = finished?.at ?? lastAt(events) ?? t0;

  const m: RunMetrics = {
    runId: started?.runId ?? 'unknown',
    strategy: started?.strategy ?? 'unknown',
    agents: started?.agents ?? 0,
    tasks: started?.tasks ?? 0,
    wallSeconds: (t1 - t0) / 1000,
    landed: 0,
    failed: 0,
    timeToAllGreenSeconds: null,
    timeToLastLandingSeconds: null,
    agentMinutes: 0,
    wastedAgentMinutes: 0,
    inputTokens: 0,
    outputTokens: 0,
    toolCalls: 0,
    rejections: { stale: 0, 'impact-failed': 0, rejected: 0, 'needs-rebase': 0, 'push-rejected': 0 },
    rebases: 0,
    conflictFiles: 0,
    checkpoints: 0,
    notices: { interrupt: 0, review: 0, ignore: 0 },
    autoMerged: 0,
    regressions: 0,
    breakagesCaught: 0,
    finalCi: null,
    throughputPerMinute: 0,
    cleanLandings: 0,
    interrupts: 0,
    falseInterrupts: 0,
  };

  const startOf = new Map<string, number>();
  const firstReject = new Map<string, number>();
  const everGreen = new Set<string>();
  const regressed = new Set<string>();
  const seenFailing = new Set<string>();
  let lastLanding: number | null = null;

  for (const e of events) {
    switch (e.type) {
      case 'task.started':
        startOf.set(e.agentId, e.at);
        break;
      case 'task.finished': {
        const s = startOf.get(e.agentId);
        if (s === undefined) break;
        const minutes = (e.at - s) / 60_000;
        m.agentMinutes += minutes;
        if (e.outcome === 'landed') {
          m.landed++;
          if (!firstReject.has(e.agentId)) m.cleanLandings++;
          const r = firstReject.get(e.agentId);
          if (r !== undefined) m.wastedAgentMinutes += (e.at - r) / 60_000;
        } else {
          m.failed++;
          m.wastedAgentMinutes += minutes;
        }
        startOf.delete(e.agentId);
        break;
      }
      case 'agent.usage':
        m.inputTokens += e.inputTokens;
        m.outputTokens += e.outputTokens;
        m.toolCalls += e.toolCalls;
        m.interrupts += e.interrupts ?? 0;
        m.falseInterrupts += e.falseInterrupts ?? 0;
        break;
      case 'promotion.rejected':
        m.rejections[e.reason]++;
        if (!firstReject.has(e.agentId)) firstReject.set(e.agentId, e.at);
        if (e.reason === 'impact-failed') m.breakagesCaught++;
        break;
      case 'rebase':
        m.rebases++;
        m.conflictFiles += e.conflicts;
        break;
      case 'checkpoint':
        m.checkpoints++;
        break;
      case 'notice':
        m.notices[e.notice.severity]++;
        break;
      case 'landed':
        if (e.agentId === 'seed') break;
        m.autoMerged += e.merged;
        lastLanding = e.at;
        break;
      case 'ci': {
        const failing = new Set(e.failing);
        for (const f of failing) if (everGreen.has(f)) regressed.add(f);
        // CI reports only failing files; a file that failed before and passes now has been green.
        for (const f of seenFailing) if (!failing.has(f)) everGreen.add(f);
        for (const f of failing) seenFailing.add(f);
        if (e.failed === 0 && m.timeToAllGreenSeconds === null) m.timeToAllGreenSeconds = (e.at - t0) / 1000;
        m.finalCi = { passed: e.passed, failed: e.failed };
        break;
      }
      default:
        break;
    }
  }
  // Attempts still open at the end did not land.
  for (const s of startOf.values()) {
    const minutes = (t1 - s) / 60_000;
    m.agentMinutes += minutes;
    m.wastedAgentMinutes += minutes;
  }
  m.regressions = regressed.size;
  m.timeToLastLandingSeconds = lastLanding === null ? null : (lastLanding - t0) / 1000;
  m.throughputPerMinute = m.wallSeconds > 0 ? m.landed / (m.wallSeconds / 60) : 0;
  return m;
}

function lastAt(events: RunEvent[]): number | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i] as { at?: number } | undefined;
    if (e && typeof e.at === 'number') return e.at;
    const n = (events[i] as { notice?: { at: number } } | undefined)?.notice;
    if (n) return n.at;
  }
  return undefined;
}

const ROWS: [string, (m: RunMetrics) => string][] = [
  ['agents / tasks', (m) => `${m.agents} / ${m.tasks}`],
  ['landed / failed', (m) => `${m.landed} / ${m.failed}`],
  ['wall time', (m) => fmtS(m.wallSeconds)],
  ['time to all-green', (m) => (m.timeToAllGreenSeconds === null ? 'never' : fmtS(m.timeToAllGreenSeconds))],
  ['throughput (landings/min)', (m) => m.throughputPerMinute.toFixed(2)],
  ['agent-minutes', (m) => m.agentMinutes.toFixed(1)],
  ['wasted agent-minutes', (m) => `${m.wastedAgentMinutes.toFixed(1)} (${pct(m.wastedAgentMinutes, m.agentMinutes)})`],
  ['tokens in / out', (m) => `${fmtN(m.inputTokens)} / ${fmtN(m.outputTokens)}`],
  ['rebases (conflicted files)', (m) => `${m.rebases} (${m.conflictFiles})`],
  ['rejected submits', (m) => Object.entries(m.rejections).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(', ') || '0'],
  ['landed on first submit', (m) => `${m.cleanLandings} (${pct(m.cleanLandings, m.landed)})`],
  ['checkpoints', (m) => String(m.checkpoints)],
  ['false-interrupt rate', (m) => (m.interrupts > 0 ? `${pct(m.falseInterrupts, m.interrupts)} of ${m.interrupts}` : 'n/a')],
  ['notices interrupt / review', (m) => `${m.notices.interrupt} / ${m.notices.review}`],
  ['auto-merged files', (m) => String(m.autoMerged)],
  ['breakages caught before landing', (m) => String(m.breakagesCaught)],
  ['breakages that landed (regressions)', (m) => String(m.regressions)],
  ['final CI (tests passed / failed)', (m) => (m.finalCi ? `${m.finalCi.passed} / ${m.finalCi.failed}` : 'n/a')],
];

/** Markdown scoreboard: one column per run. */
export function scoreboard(runs: RunMetrics[]): string {
  const header = `| metric | ${runs.map((r) => r.strategy).join(' | ')} |`;
  const sep = `|---|${runs.map(() => '---').join('|')}|`;
  const rows = ROWS.map(([name, f]) => `| ${name} | ${runs.map(f).join(' | ')} |`);
  return [header, sep, ...rows].join('\n');
}

function fmtS(s: number): string {
  if (s < 90) return `${s.toFixed(1)} s`;
  return `${(s / 60).toFixed(1)} min`;
}

function fmtN(n: number): string {
  return n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n);
}

function pct(a: number, b: number): string {
  return b > 0 ? `${((a / b) * 100).toFixed(0)}%` : '0%';
}
