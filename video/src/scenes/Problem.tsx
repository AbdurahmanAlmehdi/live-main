import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { C, MONO } from '../theme';
import { useT } from '../timing';
import { Chip, Kicker, Paper, Rise, useProgress } from '../ui';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Part A: branches fall behind a moving main and loop through rebases. */
const Branches: React.FC = () => {
  const t = useT();
  const f = useCurrentFrame();
  const mainY = 620;
  const lanes = [
    { y: 250, fork: 260, label: 'agent 1' },
    { y: 350, fork: 380, label: 'agent 2' },
    { y: 450, fork: 470, label: 'agent 3' },
    { y: 790, fork: 330, label: 'agent 4' },
    { y: 890, fork: 520, label: 'agent 5' },
  ];
  const grow = interpolate(f, [t(1), t(7)], [0, 1], clamp);
  const mainEnd = interpolate(f, [t(0.5), t(18)], [620, 1650], clamp);
  const versions = Math.floor(interpolate(f, [t(0.5), t(18)], [3, 15], clamp));
  const rebases = Math.floor(interpolate(f, [t(8), t(20)], [0, 2215], clamp));
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{ position: 'absolute' }}>
        <line x1={160} y1={mainY} x2={mainEnd} y2={mainY} stroke={C.ink} strokeWidth={6} strokeLinecap="round" />
        {Array.from({ length: versions }, (_, i) => (
          <circle key={i} cx={200 + i * 100} cy={mainY} r={13} fill={C.paper} stroke={C.ink} strokeWidth={5} />
        ))}
        {lanes.map((l, i) => {
          const end = l.fork + 140 + grow * 640;
          const d = `M ${l.fork} ${mainY} C ${l.fork + 70} ${mainY}, ${l.fork + 40} ${l.y}, ${l.fork + 140} ${l.y} L ${end} ${l.y}`;
          // after 8s, each lane tries to merge back and bounces
          const tryAt = t(8 + i * 1.6);
          const bounce = (f - tryAt) % t(4);
          const merging = f > tryAt && bounce < t(1.4);
          const mx = end + 30;
          return (
            <g key={i}>
              <path d={d} stroke={C.teal} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.85} />
              {merging && <path d={`M ${end} ${l.y} Q ${mx + 60} ${(l.y + mainY) / 2}, ${mx + 120} ${mainY}`} stroke={C.red} strokeWidth={4} strokeDasharray="10 10" fill="none" opacity={1 - bounce / t(1.4)} />}
            </g>
          );
        })}
      </svg>
      {lanes.map((l, i) => {
        const tryAt = t(8 + i * 1.6);
        const end = l.fork + 140 + grow * 640;
        const phase = f > tryAt ? Math.floor((f - tryAt) / t(4)) % 3 : -1;
        const label = ['conflict · src/core/registry.ts', 'needs rebase · main moved', 'tests fail after rebase'][Math.max(phase, 0)]!;
        return (
          <React.Fragment key={i}>
            <div style={{ position: 'absolute', left: l.fork + 150, top: l.y - 52, fontFamily: MONO, fontSize: 22, color: C.ink2, opacity: grow }}>{l.label}</div>
            {phase >= 0 && (
              <div style={{ position: 'absolute', left: end + 40, top: l.y - 20 }}>
                <Chip fg={C.red} bg={C.redBg} size={20}>{label}</Chip>
              </div>
            )}
          </React.Fragment>
        );
      })}
      <div style={{ position: 'absolute', left: 160, top: mainY + 26, fontFamily: MONO, fontSize: 24, color: C.ink }}>main</div>
      <Rise at={t(8)} style={{ position: 'absolute', right: 110, top: 120, textAlign: 'right' }}>
        <div style={{ fontFamily: MONO, fontSize: 26, color: C.muted }}>rebases</div>
        <div style={{ fontSize: 120, fontWeight: 700, color: C.red, fontVariantNumeric: 'tabular-nums', letterSpacing: -3 }}>{rebases.toLocaleString('en-US')}</div>
      </Rise>
    </AbsoluteFill>
  );
};

/** Part B: the conflict git can't see. */
const ReadWrite: React.FC = () => {
  const t = useT();
  const f = useCurrentFrame();
  const wrong = useProgress(t(33), 12);
  const card = (who: string, lines: React.ReactNode, at: number, broken = false) => (
    <Rise at={at} style={{ width: 640, background: C.raised, border: `2px solid ${broken && wrong > 0.5 ? C.red : C.border}`, borderRadius: 18, padding: 36, boxShadow: '0 10px 30px rgba(31,29,26,.06)' }}>
      <div style={{ fontFamily: MONO, fontSize: 26, color: C.teal, marginBottom: 18 }}>{who}</div>
      <div style={{ fontSize: 34, lineHeight: 1.45 }}>{lines}</div>
      <div style={{ marginTop: 26, display: 'flex', gap: 12 }}>
        {f >= t(29) && <Chip fg={C.green} bg={C.greenBg}>✓ merged cleanly</Chip>}
        {broken && f >= t(33) && <span style={{ opacity: wrong }}><Chip fg={C.red} bg={C.redBg}>✗ SUM is now wrong</Chip></span>}
      </div>
    </Rise>
  );
  const mono = (s: string) => <span style={{ fontFamily: MONO, background: C.selected, padding: '2px 10px', borderRadius: 6 }}>{s}</span>;
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 56 }}>
      <Rise at={t(22.5)} style={{ fontSize: 56, fontWeight: 700, letterSpacing: -1.5 }}>The conflict git can’t see</Rise>
      <div style={{ display: 'flex', gap: 60 }}>
        {card('agent A', <>reads {mono('coerce.ts')} to learn how values are converted, then writes {mono('SUM.ts')}</>, t(23.5), true)}
        {card('agent B', <>changes how {mono('coerce.ts')} converts text to numbers</>, t(25.5))}
      </div>
      <Rise at={t(35)} style={{ fontSize: 38, color: C.ink2 }}>Nothing in git records what an agent <b style={{ color: C.ink }}>read</b>.</Rise>
    </AbsoluteFill>
  );
};

const Wasted: React.FC = () => {
  const t = useT();
  const f = useCurrentFrame();
  const pct = Math.round(interpolate(f, [t(40.5), t(43)], [0, 93], clamp));
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
      <Rise at={t(40.3)} style={{ fontSize: 300, fontWeight: 700, color: C.red, letterSpacing: -12, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{pct}%</Rise>
      <Rise at={t(41.5)} style={{ fontSize: 48, fontWeight: 500, marginTop: 10 }}>of agent time wasted on rebases and redone work</Rise>
      <Rise at={t(42.5)} style={{ fontFamily: MONO, fontSize: 26, color: C.muted, marginTop: 26 }}>pull-request flow · 16 agents · 336 tasks · our benchmark</Rise>
    </AbsoluteFill>
  );
};

export const Problem: React.FC = () => {
  const t = useT();
  const f = useCurrentFrame();
  const fade = (a: number, b: number) => interpolate(f, [a, a + 10, b - 10, b], [0, 1, 1, 0], clamp);
  return (
    <Paper>
      <Kicker n={1} label="the problem" />
      {f < t(22.3) && <AbsoluteFill style={{ opacity: fade(0, t(22.3)) }}><Branches /></AbsoluteFill>}
      {f >= t(22.3) && f < t(40) && <AbsoluteFill style={{ opacity: fade(t(22.3), t(40)) }}><ReadWrite /></AbsoluteFill>}
      {f >= t(40) && <Wasted />}
    </Paper>
  );
};
