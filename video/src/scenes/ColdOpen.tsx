import React from 'react';
import { AbsoluteFill, interpolate, random, useCurrentFrame } from 'remotion';
import { C, MONO } from '../theme';
import { useT } from '../timing';
import { Paper, Rise, Wordmark, useProgress } from '../ui';

const FLOW = ['branch', 'pull request', 'review', 'merge'];

export const ColdOpen: React.FC = () => {
  const t = useT();
  const f = useCurrentFrame();
  const swarm = useProgress(t(9.5), 40);
  const outA = t(8.6);
  const logo = t(14);
  return (
    <Paper>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 48 }}>
        {f < outA + 14 && (
          <>
            <Rise at={t(0.4)} out={outA} style={{ fontSize: 78, fontWeight: 700, letterSpacing: -2, textAlign: 'center', lineHeight: 1.15 }}>
              Git and GitHub were built<br />for people who take turns.
            </Rise>
            <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
              {FLOW.map((s, i) => (
                <Rise key={s} at={t(3.2 + i * 0.9)} out={outA} style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                  <span style={{ fontFamily: MONO, fontSize: 34, padding: '10px 22px', borderRadius: 10, background: C.raised, border: `1px solid ${C.border}` }}>{s}</span>
                  {i < FLOW.length - 1 && <span style={{ fontSize: 34, color: C.muted }}>→</span>}
                </Rise>
              ))}
            </div>
          </>
        )}
        {f >= outA + 14 && f < logo + 6 && (
          <Rise at={outA + 14} out={logo - 8} style={{ fontSize: 96, fontWeight: 700, letterSpacing: -3 }}>
            Agents don’t take turns.
          </Rise>
        )}
      </AbsoluteFill>
      {/* the swarm: 60 agents converging on one repository */}
      {f >= t(9.5) && f < logo + 10 && (
        <AbsoluteFill style={{ opacity: interpolate(f, [logo - 10, logo + 6], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
          {Array.from({ length: 60 }, (_, i) => {
            const a = random(`a${i}`) * Math.PI * 2;
            const r0 = 900 + random(`r${i}`) * 300;
            const r1 = 260 + random(`q${i}`) * 260;
            const r = r0 + (r1 - r0) * swarm;
            const jitter = Math.sin((f + i * 7) / 6) * 6 * swarm;
            return <div key={i} style={{ position: 'absolute', left: 960 + Math.cos(a) * r + jitter, top: 540 + Math.sin(a) * r * 0.62, width: 16, height: 16, borderRadius: '50%', background: i % 9 === 0 ? C.red : C.teal, opacity: 0.8 }} />;
          })}
        </AbsoluteFill>
      )}
      {f >= logo && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 30 }}>
          <Rise at={logo}><Wordmark size={150} /></Rise>
          <Rise at={logo + 14} style={{ fontSize: 40, color: C.ink2 }}>Version control for agent swarms</Rise>
        </AbsoluteFill>
      )}
    </Paper>
  );
};
