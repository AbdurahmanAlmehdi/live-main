import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, MONO, SANS } from './theme';

/** 0→1 over [start, start+dur] frames, eased. */
export function useProgress(start: number, dur = 18, easing = Easing.out(Easing.cubic)): number {
  const f = useCurrentFrame();
  return interpolate(f, [start, start + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });
}

export function useSpring(start: number, damping = 16): number {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - start, fps, config: { damping } });
}

export const Paper: React.FC<{ children?: React.ReactNode; tone?: 'paper' | 'ink' }> = ({ children, tone = 'paper' }) => (
  <AbsoluteFill style={{ background: tone === 'ink' ? C.ink : C.paper, color: tone === 'ink' ? C.paper : C.ink, fontFamily: SANS }}>{children}</AbsoluteFill>
);

/** Fades and lifts in at `at`. */
export const Rise: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; dy?: number; out?: number }> = ({ at, children, style, dy = 24, out }) => {
  const f = useCurrentFrame();
  const p = useProgress(at);
  const o = out === undefined ? 1 : interpolate(f, [out, out + 12], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <div style={{ opacity: p * o, transform: `translateY(${(1 - p) * dy}px)`, ...style }}>{children}</div>;
};

/** The "live" mark: teal dot with a soft pulse. */
export const LiveDot: React.FC<{ size?: number }> = ({ size = 18 }) => {
  const f = useCurrentFrame();
  const pulse = (f % 45) / 45;
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: C.teal, opacity: 0.35 * (1 - pulse), transform: `scale(${1 + pulse * 1.4})` }} />
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: C.teal }} />
    </span>
  );
};

export const Wordmark: React.FC<{ size?: number; color?: string }> = ({ size = 120, color = C.ink }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.28, fontFamily: SANS, fontWeight: 700, fontSize: size, color, letterSpacing: -size * 0.03 }}>
    <LiveDot size={size * 0.32} />
    Live Main
  </div>
);

export const Chip: React.FC<{ fg: string; bg: string; children: React.ReactNode; size?: number }> = ({ fg, bg, children, size = 22 }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: `${size * 0.2}px ${size * 0.55}px`, borderRadius: 999, background: bg, color: fg, fontFamily: MONO, fontSize: size, fontWeight: 500, whiteSpace: 'nowrap' }}>{children}</span>
);

/** Scene label, top-left: "05 · Claude Code swarm". */
export const Kicker: React.FC<{ n: number; label: string; dark?: boolean }> = ({ n, label, dark }) => {
  const p = useProgress(4);
  return (
    <div style={{ position: 'absolute', left: 72, top: 48, opacity: p, display: 'flex', gap: 14, alignItems: 'baseline', fontFamily: MONO, fontSize: 24, color: dark ? C.borderStrong : C.muted, zIndex: 5 }}>
      <span style={{ color: C.teal, fontWeight: 500 }}>{String(n).padStart(2, '0')}</span>
      <span>{label}</span>
    </div>
  );
};

/** A window frame around footage (browser or terminal). */
export const Frame: React.FC<{ title: string; kind: 'browser' | 'terminal'; style?: React.CSSProperties; children: React.ReactNode }> = ({ title, kind, style, children }) => (
  <div style={{ position: 'absolute', borderRadius: 14, overflow: 'hidden', boxShadow: '0 30px 80px rgba(31,29,26,.18), 0 0 0 1px rgba(31,29,26,.10)', background: kind === 'terminal' ? C.term : C.raised, display: 'flex', flexDirection: 'column', ...style }}>
    <div style={{ height: 40, flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', background: kind === 'terminal' ? '#2A2824' : C.sunken, borderBottom: `1px solid ${kind === 'terminal' ? '#34312C' : C.border}` }}>
      {['#E26A5A', '#E2B33F', '#5DB462'].map((c) => <span key={c} style={{ width: 13, height: 13, borderRadius: '50%', background: c }} />)}
      <span style={{ marginLeft: 14, fontFamily: MONO, fontSize: 17, color: kind === 'terminal' ? '#A8A296' : C.muted, overflow: 'hidden', whiteSpace: 'nowrap' }}>{title}</span>
    </div>
    <div style={{ position: 'relative', flex: 1 }}>{children}</div>
  </div>
);

/** A callout bubble that points at something in the footage. */
export const Callout: React.FC<{ at: number; out?: number; x: number; y: number; children: React.ReactNode; tone?: 'teal' | 'amber' | 'green' | 'red'; w?: number }> = ({ at, out, x, y, children, tone = 'teal', w = 420 }) => {
  const f = useCurrentFrame();
  const s = useSpring(at, 14);
  const o = out === undefined ? 1 : interpolate(f, [out, out + 10], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const color = { teal: C.teal, amber: C.amber, green: C.green, red: C.red }[tone];
  if (f < at) return null;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, opacity: o, transform: `scale(${0.9 + 0.1 * s})`, transformOrigin: 'top left', background: C.ink, color: C.paper, borderRadius: 12, padding: '16px 20px', fontSize: 26, lineHeight: 1.3, boxShadow: '0 16px 40px rgba(0,0,0,.25)', borderLeft: `6px solid ${color}`, zIndex: 10 }}>
      {children}
    </div>
  );
};
