import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { C, MONO } from '../theme';
import { useT } from '../timing';
import { Kicker, Paper, Rise } from '../ui';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

interface Box { id: string; x: number; y: number; w: number; title: string; sub: string; at: number; color: string }

const BOXES: Box[] = [
  { id: 'clients', x: 70, y: 430, w: 340, title: 'You + agents', sub: 'browser · git · Claude Code', at: 1, color: C.ink },
  { id: 'worker', x: 490, y: 430, w: 360, title: 'Worker + Access', sub: 'app · API · git gateway', at: 4, color: '#F38020' },
  { id: 'org', x: 940, y: 200, w: 390, title: 'OrgDO', sub: 'people · tokens · model keys', at: 9, color: '#F38020' },
  { id: 'repo', x: 940, y: 430, w: 390, title: 'RepoDO', sub: 'coordinator · promotion', at: 11, color: '#F38020' },
  { id: 'agent', x: 940, y: 660, w: 390, title: 'RepoAgentDO × N', sub: 'one Durable Object per agent', at: 13, color: '#F38020' },
  { id: 'wc', x: 1420, y: 330, w: 430, title: 'Containers', sub: 'FUSE workcells · integrator', at: 19, color: C.teal },
  { id: 'art', x: 1420, y: 590, w: 430, title: 'Artifacts', sub: 'main is a git repo you can clone', at: 26, color: C.teal },
];

const EDGES: [string, string, number][] = [
  ['clients', 'worker', 6],
  ['worker', 'org', 10],
  ['worker', 'repo', 11.5],
  ['repo', 'agent', 14],
  ['agent', 'wc', 20],
  ['repo', 'wc', 21],
  ['wc', 'art', 27],
];

const H = 140;
const at = (id: string) => BOXES.find((b) => b.id === id)!;

export const Cloudflare: React.FC = () => {
  const t = useT();
  const f = useCurrentFrame();
  return (
    <Paper>
      <Kicker n={8} label="built on Cloudflare" />
      <Rise at={t(0.2)} style={{ position: 'absolute', left: 72, top: 110, fontSize: 64, fontWeight: 700, letterSpacing: -2 }}>All of it runs on Cloudflare</Rise>
      <svg width={1920} height={1080} style={{ position: 'absolute' }}>
        {EDGES.map(([a, b, s]) => {
          const A = at(a), B = at(b);
          const [x1, y1, x2, y2] = A.x + A.w <= B.x ? [A.x + A.w, A.y + H / 2, B.x, B.y + H / 2] : [A.x + A.w / 2, A.y + H, B.x + B.w / 2, B.y];
          const p = interpolate(f, [t(s), t(s) + 18], [0, 1], clamp);
          const mx = (x1 + x2) / 2;
          const d = A.x + A.w <= B.x ? `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}` : `M ${x1} ${y1} L ${x2} ${y2}`;
          const len = Math.hypot(x2 - x1, y2 - y1) * 1.3;
          const dot = ((f - t(s)) % 50) / 50;
          return (
            <g key={a + b}>
              <path d={d} stroke={C.borderStrong} strokeWidth={3} fill="none" strokeDasharray={len} strokeDashoffset={len * (1 - p)} />
              {p >= 1 && <circle r={6} fill={C.teal} cx={x1 + (x2 - x1) * dot} cy={y1 + (y2 - y1) * dot} opacity={0.7} />}
            </g>
          );
        })}
      </svg>
      {BOXES.map((b) => (
        <Rise key={b.id} at={t(b.at)} style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: H, boxSizing: 'border-box', background: C.raised, borderRadius: 14, border: `1px solid ${C.border}`, borderTop: `6px solid ${b.color}`, padding: '20px 24px', boxShadow: '0 12px 30px rgba(31,29,26,.07)' }}>
          <div style={{ fontWeight: 700, fontSize: 32 }}>{b.title}</div>
          <div style={{ fontFamily: MONO, fontSize: 17, color: C.muted, marginTop: 10, whiteSpace: 'nowrap' }}>{b.sub}</div>
        </Rise>
      ))}
      <Rise at={t(33)} style={{ position: 'absolute', left: 72, bottom: 110, display: 'flex', gap: 40, fontFamily: MONO, fontSize: 24, color: C.ink2 }}>
        <span>Workers</span><span>Durable Objects</span><span>Containers</span><span>Artifacts</span><span>Access</span>
      </Rise>
    </Paper>
  );
};
