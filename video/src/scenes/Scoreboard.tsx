import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { C, MONO } from '../theme';
import { Paper, Rise } from '../ui';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** bench/results/full-bank-16-agents-seed1.md */
const ROWS = [
  { label: 'time to finish', lm: 25.6, pr: 79.4, unit: ' min', lmNote: 'all green', prNote: 'never green' },
  { label: 'rebases', lm: 0, pr: 2215, unit: '' },
  { label: 'regressions that landed', lm: 1, pr: 28, unit: '' },
  { label: 'agent time wasted', lm: 9, pr: 93, unit: '%' },
];

/** `at`: local start frame; `step`: frames between rows. */
export const Scoreboard: React.FC<{ at: number; step: number }> = ({ at, step }) => {
  const f = useCurrentFrame();
  return (
    <Paper>
      <AbsoluteFill style={{ padding: '120px 140px' }}>
        <Rise at={at} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 60, fontWeight: 700, letterSpacing: -2 }}>Full task bank, 16 agents</span>
          <span style={{ fontFamily: MONO, fontSize: 24, color: C.muted }}>336 tasks · same agents · same tests</span>
        </Rise>
        <div style={{ display: 'flex', gap: 30, marginTop: 30, fontFamily: MONO, fontSize: 24 }}>
          <span style={{ color: C.teal }}>■ Live Main</span>
          <span style={{ color: C.borderStrong }}>■ pull-request flow</span>
        </div>
        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 44 }}>
          {ROWS.map((r, i) => {
            const s = at + 12 + i * step;
            const p = interpolate(f, [s, s + 24], [0, 1], { ...clamp });
            const max = Math.max(r.lm, r.pr);
            const fmt = (v: number) => (Number.isInteger(v) ? Math.round(v * p).toLocaleString('en-US') : (v * p).toFixed(1)) + r.unit;
            const bar = (v: number, color: string, note?: string) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, height: 44 }}>
                <div style={{ height: 34, width: Math.max(6, (v / max) * 820 * p), background: color, borderRadius: 6 }} />
                <span style={{ fontFamily: MONO, fontSize: 30, fontWeight: 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(v)}</span>
                {note && p > 0.95 && <span style={{ fontFamily: MONO, fontSize: 22, color: C.muted, whiteSpace: 'nowrap' }}>{note}</span>}
              </div>
            );
            return (
              <Rise key={r.label} at={s} style={{ display: 'grid', gridTemplateColumns: '440px 1fr', alignItems: 'center' }}>
                <div style={{ fontSize: 34, fontWeight: 500 }}>{r.label}</div>
                <div>
                  {bar(r.lm, C.teal, r.lmNote)}
                  {bar(r.pr, C.borderStrong, r.prNote)}
                </div>
              </Rise>
            );
          })}
        </div>
      </AbsoluteFill>
    </Paper>
  );
};

/** The synthetic coordinator test (bench/runs/synth-inproc-10000-*.md). */
export const Synthetic: React.FC<{ at: number }> = ({ at }) => {
  const f = useCurrentFrame();
  const n = Math.round(interpolate(f, [at, at + 40], [0, 10000], clamp));
  return (
    <Paper tone="ink">
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 18 }}>
        <Rise at={at} style={{ fontSize: 220, fontWeight: 700, letterSpacing: -8, color: C.paper, fontVariantNumeric: 'tabular-nums' }}>{n.toLocaleString('en-US')}</Rise>
        <Rise at={at + 10} style={{ fontSize: 48 }}>synthetic agents on one coordinator</Rise>
        <Rise at={at + 24} style={{ display: 'flex', gap: 60, marginTop: 40, fontFamily: MONO, fontSize: 34, color: '#CFE6E6' }}>
          <span>p99 promote 13.7 ms</span>
          <span>57 landings / s</span>
        </Rise>
        <Rise at={at + 34} style={{ fontFamily: MONO, fontSize: 22, color: C.borderStrong, marginTop: 30 }}>synthetic: scripted change shapes, no LLM, measures the coordinator only</Rise>
      </AbsoluteFill>
    </Paper>
  );
};
