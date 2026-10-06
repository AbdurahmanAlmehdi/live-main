import React from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile } from 'remotion';
import { C, FPS } from './theme';
import { useT } from './timing';
import { Callout, Frame, Kicker, Paper } from './ui';

/** Pixel size of each recording in public/rec (see `ffprobe`). */
export const SIZES: Record<string, [number, number]> = {
  'swarm.mp4': [1920, 1080],
  'scale.mp4': [1920, 1080],
  'tour.mp4': [1920, 1080],
  'claude.mp4': [2276, 1366],
  'push.mp4': [1934, 1210],
};

export interface Pane {
  src: string;
  /** source seconds */
  from: number;
  to: number;
  title: string;
  /** a small terminal in the corner over the main pane */
  pip?: boolean;
}

export interface CalloutSpec {
  /** seconds into the segment (planned) */
  at: number;
  out?: number;
  x: number;
  y: number;
  w?: number;
  tone?: 'teal' | 'amber' | 'green' | 'red';
  text: React.ReactNode;
}

export interface Segment {
  /** planned seconds on screen */
  sec: number;
  panes: Pane[];
  callouts?: CalloutSpec[];
}

const BOX = { left: 160, top: 96, w: 1600, h: 900 };
const BAR = 40;

function fit(src: string, maxW: number, maxH: number): { w: number; h: number } {
  const [sw, sh] = SIZES[src] ?? [1920, 1080];
  const s = Math.min(maxW / sw, (maxH - BAR) / sh);
  return { w: Math.round(sw * s), h: Math.round(sh * s) + BAR };
}

const PaneView: React.FC<{ p: Pane; frames: number }> = ({ p, frames }) => {
  const terminal = p.src === 'claude.mp4' || p.src === 'push.mp4';
  const rate = (p.to - p.from) / (frames / FPS);
  const size = p.pip ? fit(p.src, 680, 460) : fit(p.src, BOX.w, BOX.h + BAR);
  const pos: React.CSSProperties = p.pip ? { right: 60, bottom: 70, ...{ width: size.w, height: size.h } } : { left: (1920 - size.w) / 2, top: BOX.top, width: size.w, height: size.h };
  return (
    <Frame kind={terminal ? 'terminal' : 'browser'} title={p.title} style={pos}>
      <OffthreadVideo src={staticFile(`rec/${p.src}`)} trimBefore={Math.round(p.from * FPS)} playbackRate={rate} muted style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
    </Frame>
  );
};

/** A scene of recorded footage: segments in order, each stretched to its planned length. */
export const FootageScene: React.FC<{ n: number; label: string; segments: Segment[] }> = ({ n, label, segments }) => {
  const t = useT();
  let acc = 0;
  return (
    <Paper>
      {segments.map((s, i) => {
        const from = t(acc);
        acc += s.sec;
        const frames = t(acc) - from;
        const local = (sec: number) => Math.round((sec / s.sec) * frames);
        return (
          <Sequence key={i} from={from} durationInFrames={frames} layout="none">
            <AbsoluteFill>
              {[...s.panes].sort((a, b) => Number(!!a.pip) - Number(!!b.pip)).map((p) => <PaneView key={p.src + p.from} p={p} frames={frames} />)}
              {s.callouts?.map((c, k) => (
                <Callout key={k} at={local(c.at)} out={c.out === undefined ? undefined : local(c.out)} x={c.x} y={c.y} w={c.w} tone={c.tone}>{c.text}</Callout>
              ))}
            </AbsoluteFill>
          </Sequence>
        );
      })}
      <Kicker n={n} label={label} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: `inset 0 0 0 1px ${C.border}` }} />
    </Paper>
  );
};
