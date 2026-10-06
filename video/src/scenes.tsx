import React from 'react';
import { Sequence } from 'remotion';
import { FootageScene, type Segment } from './Footage';
import { useT } from './timing';
import { Cloudflare } from './scenes/Cloudflare';
import { ColdOpen } from './scenes/ColdOpen';
import { Idea } from './scenes/Idea';
import { Outro } from './scenes/Outro';
import { Problem } from './scenes/Problem';
import { Scoreboard, Synthetic } from './scenes/Scoreboard';
import voiceover from './voiceover.json';

const VO: Record<string, string[]> = voiceover;

/**
 * The video, scene by scene. `vo` (from voiceover.json) is the narration and the captions;
 * `tools/tts.mjs` voices it into public/vo/<id>.mp3 and the scene stretches to fit.
 */
export interface Scene {
  id: string;
  planned: number;
  vo: string[];
  render: () => React.ReactNode;
}

const SITE = 'live-main.abdurahman-i-work.workers.dev';
const CC = '~/swarm-demo — claude';
const SH = '~/push-work — zsh';

const claudeCode: Segment[] = [
  { sec: 13, panes: [{ src: 'claude.mp4', from: 4, to: 36, title: CC }], callouts: [
    { at: 1, out: 5.5, x: 1180, y: 300, w: 520, text: <>One prompt: dispatch six tasks with worker <b>claude-code</b>, then run four subagents.</> },
    { at: 8.5, x: 1180, y: 520, w: 520, tone: 'green', text: <>Four Claude Code subagents start, each claiming a seat over <b>lm mcp</b>.</> },
  ] },
  { sec: 22, panes: [
    { src: 'swarm.mp4', from: 40, to: 66, title: `${SITE}/demo/formula-engine/swarms` },
    { src: 'claude.mp4', from: 40, to: 76, title: CC, pip: true },
  ], callouts: [
    { at: 2, out: 9, x: 240, y: 700, w: 560, text: <>Each seat is an overlay on main, on the server. Tool calls run there: read, edit, run tests, submit.</> },
    { at: 10, out: 21, x: 240, y: 700, w: 560, tone: 'green', text: <>All five functions edit <b>src/core/registry.ts</b>. Zero rebases: the overlapping edits merge automatically.</> },
  ] },
  { sec: 12, panes: [{ src: 'claude.mp4', from: 84, to: 100, title: CC }], callouts: [
    { at: 1.5, x: 1250, y: 330, w: 470, tone: 'green', text: <>6 of 6 landed, CI green on every version.</> },
    { at: 5, x: 1180, y: 700, w: 600, tone: 'amber', text: <>v7 changed a protected helper. I approved it in the browser while its submit was still waiting, so the subagent just saw it land.</> },
  ] },
];

const approvals: Segment[] = [
  { sec: 8, panes: [{ src: 'swarm.mp4', from: 0, to: 7, title: `${SITE}/demo/formula-engine/settings` }], callouts: [
    { at: 1, x: 1160, y: 420, w: 520, tone: 'amber', text: <>Protect shared helpers: <b>src/helpers/**</b></> },
  ] },
  { sec: 17, panes: [{ src: 'swarm.mp4', from: 62, to: 80, title: `${SITE}/demo/formula-engine/approvals` }], callouts: [
    { at: 0.5, out: 7, x: 240, y: 760, w: 600, tone: 'amber', text: <>The GCD helper is ready, but it touches a protected path, so its landing waits for a person.</> },
    { at: 9, x: 1160, y: 220, w: 520, tone: 'green', text: <>Approve, and it lands.</> },
  ] },
  { sec: 13, panes: [{ src: 'swarm.mp4', from: 101, to: 114, title: `${SITE}/demo/formula-engine/main/7` }], callouts: [
    { at: 2, x: 1160, y: 560, w: 560, text: <>The version records the agent, who dispatched it, and who approved it.</> },
  ] },
];

const push: Segment[] = [
  { sec: 58, panes: [{ src: 'push.mp4', from: 0, to: 60, title: SH }], callouts: [
    { at: 9, out: 17, x: 1240, y: 640, w: 520, text: <>Meanwhile an agent lands v10. This clone is now behind main.</> },
    { at: 24, out: 34, x: 1240, y: 640, w: 520, tone: 'green', text: <>The stale push lands anyway, as v11: the same promotion rule as agents, with an automatic merge.</> },
    { at: 42, x: 1240, y: 640, w: 520, tone: 'red', text: <>A push that breaks a test already on main is refused, with the failing test.</> },
  ] },
];

const tour: Segment[] = [{ sec: 40, panes: [{ src: 'tour.mp4', from: 0, to: 40, title: `${SITE}/demo/formula-engine` }] }];

const Scale: React.FC = () => {
  const t = useT();
  const a = t(24), b = t(48);
  return (
    <>
      <Sequence durationInFrames={a}>
        <FootageScene n={7} label="scale" segments={[
          { sec: 15, panes: [{ src: 'scale.mp4', from: 2, to: 44, title: `${SITE}/demo/formula-engine/dispatch` }], callouts: [
            { at: 1, out: 6, x: 1180, y: 700, w: 520, text: <>Forty tasks, sixteen agents, replaying reference solutions.</> },
          ] },
          { sec: 9, panes: [{ src: 'scale.mp4', from: 53, to: 72, title: `${SITE}/demo/formula-engine/swarms` }], callouts: [
            { at: 6.5, x: 1180, y: 700, w: 520, tone: 'green', text: <>40 of 40 landed in about a minute.</> },
          ] },
        ]} />
      </Sequence>
      <Sequence from={a} durationInFrames={b - a}><Scoreboard at={4} step={Math.round((b - a) / 6)} /></Sequence>
      <Sequence from={b}><Synthetic at={4} /></Sequence>
    </>
  );
};

export const SCENES: Scene[] = [
  { id: 'cold-open', planned: 20, render: () => <ColdOpen />, vo: VO['cold-open']! },
  { id: 'problem', planned: 50, render: () => <Problem />, vo: VO['problem']! },
  { id: 'idea', planned: 60, render: () => <Idea />, vo: VO['idea']! },
  { id: 'tour', planned: 40, render: () => <FootageScene n={3} label="the app" segments={tour} />, vo: VO['tour']! },
  { id: 'claude-code', planned: 47, render: () => <FootageScene n={4} label="a Claude Code swarm" segments={claudeCode} />, vo: VO['claude-code']! },
  { id: 'approvals', planned: 38, render: () => <FootageScene n={5} label="approvals" segments={approvals} />, vo: VO['approvals']! },
  { id: 'git-push', planned: 58, render: () => <FootageScene n={6} label="git push" segments={push} />, vo: VO['git-push']! },
  { id: 'scale', planned: 60, render: () => <Scale />, vo: VO['scale']! },
  { id: 'cloudflare', planned: 40, render: () => <Cloudflare />, vo: VO['cloudflare']! },
  { id: 'outro', planned: 14, render: () => <Outro />, vo: VO['outro']! },
];
