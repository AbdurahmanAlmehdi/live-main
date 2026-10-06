import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { SCENES, type Scene } from './scenes';
import { C, FPS, SANS } from './theme';
import { SceneTiming } from './timing';

/** A narration line: where it is in the audio file (`start`–`end`) and when it plays (`at`, scene seconds). */
type Line = { text: string; start: number; end: number; at: number };

export type DemoProps = {
  /** per scene: frames on screen, its voiceover file (if any) and its lines */
  timing: { id: string; frames: number; vo: string | null; lines: Line[] }[];
  captions: boolean;
};

/** Fades in and out at the scene's edges. */
const FADE = 8;
/** Narration starts this long into a scene, and the scene runs this long after it ends. */
const LEAD = 0.5;
const TAIL = 1.3;
/** Scenes run at this share of their planned length, if the narration fits... */
const PACE = 0.82;
/** ...with at most this much quiet between two lines. */
const MAX_GAP = 3;

const Captions: React.FC<{ lines: Line[] }> = ({ lines }) => {
  const f = useCurrentFrame();
  const sec = f / FPS;
  const i = lines.findIndex((l, k) => sec >= l.at && sec < Math.min(lines[k + 1]?.at ?? Infinity, l.at + l.end - l.start + 0.8));
  const l = lines[i];
  if (!l) return null;
  const until = Math.min(lines[i + 1]?.at ?? Infinity, l.at + l.end - l.start + 0.8);
  const o = interpolate(sec, [l.at, l.at + 0.15, until - 0.15, until], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 54, pointerEvents: 'none' }}>
      <div style={{ opacity: o, maxWidth: 1400, background: 'rgba(31,29,26,.86)', color: C.paper, fontFamily: SANS, fontSize: 34, lineHeight: 1.35, padding: '12px 26px', borderRadius: 12, textAlign: 'center' }}>{l.text}</div>
    </AbsoluteFill>
  );
};

const SceneView: React.FC<{ scene: Scene; frames: number; vo: string | null; lines: Line[]; captions: boolean }> = ({ scene, frames, vo, lines, captions }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, FADE, frames - FADE, frames], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <SceneTiming planned={scene.planned} frames={frames}>
      <AbsoluteFill style={{ background: C.paper }}>
        <AbsoluteFill style={{ opacity: o }}>{scene.render()}</AbsoluteFill>
        {captions && <Captions lines={lines} />}
        {vo &&
          lines.map((l) => (
            <Sequence key={l.at} from={Math.round(l.at * FPS)} durationInFrames={Math.max(1, Math.round((l.end - l.start) * FPS))}>
              <Audio src={staticFile(vo)} trimBefore={Math.round(l.start * FPS)} />
            </Sequence>
          ))}
      </AbsoluteFill>
    </SceneTiming>
  );
};

export const Demo: React.FC<DemoProps> = ({ timing, captions }) => {
  let from = 0;
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      {SCENES.map((s) => {
        const t = timing.find((x) => x.id === s.id) ?? schedule(s, null, null);
        const seq = (
          <Sequence key={s.id} from={from} durationInFrames={t.frames} name={s.id}>
            <SceneView scene={s} frames={t.frames} vo={t.vo} lines={t.lines} captions={captions} />
          </Sequence>
        );
        from += t.frames;
        return seq;
      })}
    </AbsoluteFill>
  );
};

/**
 * Places a scene's lines: the scene lasts its paced length (kept between "narration with no
 * gaps" and "narration with MAX_GAP gaps"), and the quiet is shared out evenly between lines so
 * each lands near the visuals it describes. Without timing, lines get even shares of the scene.
 */
function schedule(s: Scene, vo: string | null, timed: { text: string; start: number; end: number }[] | null): DemoProps['timing'][number] {
  const lines = timed ?? s.vo.map((text) => ({ text, start: 0, end: text.length / 15 }));
  const speech = lines.reduce((n, l) => n + l.end - l.start, 0);
  const tight = speech + LEAD + TAIL;
  const sec = timed ? Math.min(Math.max(s.planned * PACE, tight), tight + lines.length * MAX_GAP) : s.planned;
  const gap = Math.max(0, sec - tight) / lines.length;
  let at = LEAD;
  const placed = lines.map((l) => {
    const line = { ...l, at };
    at += l.end - l.start + gap;
    return line;
  });
  return { id: s.id, frames: Math.round(sec * FPS), vo, lines: placed };
}

async function exists(path: string): Promise<boolean> {
  const r = await fetch(staticFile(path), { method: 'HEAD' }).catch(() => null);
  return !!r?.ok && !(r.headers.get('content-type') ?? '').includes('html');
}

/**
 * Each scene's narration: public/vo/<id>.mp3 or .m4a, with public/vo/<id>.json saying where each
 * line is in it (tools/tts.mjs writes both; tools/align.mjs makes the json for other audio).
 */
export async function sceneTiming(): Promise<DemoProps['timing']> {
  return Promise.all(
    SCENES.map(async (s) => {
      let vo: string | null = null;
      for (const ext of ['mp3', 'm4a']) if (!vo && (await exists(`vo/${s.id}.${ext}`))) vo = `vo/${s.id}.${ext}`;
      const timed = vo && (await exists(`vo/${s.id}.json`)) ? ((await (await fetch(staticFile(`vo/${s.id}.json`))).json()) as Line[]) : null;
      return schedule(s, timed ? vo : null, timed);
    }),
  );
}
