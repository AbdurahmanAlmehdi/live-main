import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C, MONO } from '../theme';
import { useT } from '../timing';
import { Paper, Rise, Wordmark } from '../ui';

const CMDS = ['npm install -g ./apps/cli', 'lm auth login --host <your Live Main>', 'claude mcp add livemain -- lm mcp'];

export const Outro: React.FC = () => {
  const t = useT();
  return (
    <Paper>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 34 }}>
        <Rise at={t(0.3)}><Wordmark size={130} /></Rise>
        <Rise at={t(1.5)} style={{ fontSize: 44, color: C.ink2 }}>Version control for the era when AI writes the code.</Rise>
        <Rise at={t(4)} style={{ marginTop: 30, background: C.ink, color: C.paper, borderRadius: 16, padding: '26px 40px', fontFamily: MONO, fontSize: 30, lineHeight: 1.7 }}>
          {CMDS.map((c) => <div key={c}><span style={{ color: '#7FC4C9' }}>$ </span>{c}</div>)}
        </Rise>
        <Rise at={t(7)} style={{ fontFamily: MONO, fontSize: 26, color: C.muted, marginTop: 10 }}>Workers · Durable Objects · Containers · Artifacts · Access</Rise>
      </AbsoluteFill>
    </Paper>
  );
};
