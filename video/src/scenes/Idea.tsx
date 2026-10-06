import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { C, MONO } from '../theme';
import { useT } from '../timing';
import { Chip, Kicker, LiveDot, Paper, Rise, useProgress } from '../ui';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const AGENTS = [
  { id: 'agent A', pin: 43, writes: ['src/functions/math/SUM.ts', 'src/core/registry.ts'], reads: ['README.md', 'src/helpers/coerce.ts', 'src/core/types.ts', 'tests/functions/SUM.test.ts'] },
  { id: 'agent B', pin: 44, writes: ['src/helpers/coerce.ts'], reads: ['src/helpers/coerce.ts', 'tests/helpers/coerce.test.ts'] },
  { id: 'agent C', pin: 44, writes: ['src/functions/math/ABS.ts', 'src/core/registry.ts'], reads: ['README.md', 'src/core/types.ts', 'tests/functions/ABS.test.ts'] },
];

const Ledger: React.FC = () => {
  const t = useT();
  const f = useCurrentFrame();
  const n = Math.floor(interpolate(f, [t(1), t(55)], [6, 14], clamp));
  return (
    <div style={{ position: 'absolute', left: 120, right: 120, bottom: 90, display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: MONO, fontSize: 26, marginRight: 16 }}><LiveDot size={16} /> main</div>
      {Array.from({ length: n }, (_, i) => {
        const v = 39 + i;
        const isNew = i === n - 1;
        return (
          <div key={v} style={{ fontFamily: MONO, fontSize: 22, padding: '10px 14px', borderRadius: 8, background: isNew ? C.greenBg : C.raised, color: isNew ? C.green : C.ink2, border: `1px solid ${isNew ? C.green : C.border}` }}>
            v{v} ✓
          </div>
        );
      })}
    </div>
  );
};

const Overlay: React.FC<{ a: (typeof AGENTS)[number]; i: number }> = ({ a, i }) => {
  const t = useT();
  const f = useCurrentFrame();
  const at = t(3 + i * 1.2);
  const reads = f >= t(20);
  const flagged = i === 0 && f >= t(38) && f < t(47);
  return (
    <Rise at={at} style={{ width: 520, background: 'rgba(255,255,255,.92)', border: `2px solid ${flagged ? C.amber : C.teal}`, borderRadius: 16, padding: '22px 26px', boxShadow: '0 18px 40px rgba(12,106,115,.10)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontWeight: 700, fontSize: 30 }}>{a.id}</span>
        <span style={{ fontFamily: MONO, fontSize: 20, color: C.muted }}>overlay on main@v{a.pin}</span>
      </div>
      {a.writes.map((w) => (
        <div key={w} style={{ fontFamily: MONO, fontSize: 21, color: C.teal, padding: '3px 0' }}>✎ {w}</div>
      ))}
      <div style={{ height: reads ? 'auto' : 0, overflow: 'hidden', marginTop: reads ? 10 : 0, borderTop: reads ? `1px dashed ${C.border}` : 'none', paddingTop: reads ? 10 : 0 }}>
        {a.reads.map((r, k) => (
          <div key={r} style={{ fontFamily: MONO, fontSize: 21, color: flagged && r.includes('coerce') ? C.amber : C.muted, padding: '3px 0', opacity: interpolate(f, [t(20 + k * 0.5), t(20.5 + k * 0.5)], [0, 1], clamp), fontWeight: flagged && r.includes('coerce') ? 500 : 400 }}>
            👁 {r}
          </div>
        ))}
      </div>
      {flagged && <div style={{ marginTop: 12 }}><Chip fg={C.amber} bg={C.amberBg} size={19}>notice: coerce.ts changed under you</Chip></div>}
    </Rise>
  );
};

const RULES = [
  { at: 36, fg: C.amber, bg: C.amberBg, title: 'Something you read changed', body: 'You get a notice with the diff and adapt in place.' },
  { at: 42, fg: C.green, bg: C.greenBg, title: 'Two agents appended to one file', body: 'Additive edits merge automatically. No rebase.' },
  { at: 48, fg: C.blue, bg: C.blueBg, title: 'Behavior changed', body: 'Tests whose read sets touch it run before it lands.' },
];

export const Idea: React.FC = () => {
  const t = useT();
  const f = useCurrentFrame();
  const rulesIn = useProgress(t(34.5), 20);
  return (
    <Paper>
      <Kicker n={2} label="the idea" />
      <Rise at={t(0.3)} style={{ position: 'absolute', left: 120, top: 120, fontSize: 64, fontWeight: 700, letterSpacing: -2 }}>
        {f < t(19) ? 'One live main. Every agent is an overlay on it.' : f < t(34) ? 'Every file an agent opens is recorded.' : 'Submitting promotes the overlay.'}
      </Rise>
      <Rise at={t(12)} out={t(18.5)} style={{ position: 'absolute', left: 120, top: 210, fontFamily: MONO, fontSize: 26, color: C.ink2 }}>
        overlay = main @ pin + upper dir · a FUSE filesystem in a Container
      </Rise>
      <Rise at={t(25)} out={t(33.5)} style={{ position: 'absolute', left: 120, top: 210, fontFamily: MONO, fontSize: 26, color: C.ink2 }}>
        read set: 12 of 387 files for a typical task · recorded from every open()
      </Rise>
      <div style={{ position: 'absolute', left: 120, top: 300, display: 'flex', gap: 40, transform: `translateY(${-rulesIn * 30}px) scale(${1 - rulesIn * 0.08})`, transformOrigin: 'top left', opacity: 1 - rulesIn * 0.25 }}>
        {AGENTS.map((a, i) => <Overlay key={a.id} a={a} i={i} />)}
      </div>
      {f >= t(34.5) && (
        <div style={{ position: 'absolute', left: 120, right: 120, top: 640, display: 'flex', gap: 30 }}>
          {RULES.map((r) => (
            <Rise key={r.title} at={t(r.at)} style={{ flex: 1, background: r.bg, borderRadius: 16, padding: '24px 28px', borderTop: `6px solid ${r.fg}` }}>
              <div style={{ fontWeight: 700, fontSize: 30, color: r.fg }}>{r.title}</div>
              <div style={{ fontSize: 25, marginTop: 8, color: C.ink, lineHeight: 1.35 }}>{r.body}</div>
            </Rise>
          ))}
        </div>
      )}
      {f < t(34.5) && <Ledger />}
      <Rise at={t(54)} style={{ position: 'absolute', right: 120, top: 128 }}>
        <Chip fg={C.green} bg={C.greenBg} size={34}>✓ main stays green</Chip>
      </Rise>
    </Paper>
  );
};
