// Finds when each line of src/voiceover.json is spoken in public/vo/<scene>.mp3 (audio made
// without timestamps, e.g. on the ElevenLabs website) and writes public/vo/<scene>.json, the same
// format tools/tts.mjs writes. Uses whisper.cpp (`brew install whisper-cpp`) on this machine.
//
//   node tools/align.mjs             every scene with audio
//   node tools/align.mjs idea        just these
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const MODEL = root('rec/models/ggml-base.en.bin');
if (!fs.existsSync(MODEL)) {
  console.error(`Download the model first:\n  curl -L -o ${MODEL} https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin`);
  process.exit(1);
}

const script = JSON.parse(fs.readFileSync(root('src/voiceover.json'), 'utf8'));
const args = process.argv.slice(2);
const ids = (args.length ? args : Object.keys(script)).filter((id) => fs.existsSync(root(`public/vo/${id}.mp3`)));

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Whisper's words as one character stream, each character carrying its word's start and end. */
function heard(id) {
  const wav = root(`rec/${id}.wav`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', root(`public/vo/${id}.mp3`), '-ar', '16000', '-ac', '1', wav]);
  execFileSync('whisper-cli', ['-m', MODEL, '-f', wav, '-ml', '1', '-sow', '-oj', '-of', root(`rec/${id}`)], { stdio: 'ignore' });
  const words = JSON.parse(fs.readFileSync(root(`rec/${id}.json`), 'utf8')).transcription;
  const chars = [];
  for (const w of words) for (const c of norm(w.text)) chars.push({ c, from: w.offsets.from / 1000, to: w.offsets.to / 1000 });
  return chars;
}

/** Pauses in the audio, as [start, end] seconds. */
function pauses(id) {
  const log = spawnSync('ffmpeg', ['-hide_banner', '-i', root(`public/vo/${id}.mp3`), '-af', 'silencedetect=noise=-38dB:d=0.12', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  return [...log.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

/** Moves a cut between lines to the middle of the closest pause within 0.6 s. */
function snap(t, gaps) {
  let best = null;
  for (const [s, e] of gaps) {
    const mid = (s + e) / 2;
    if (Math.abs(mid - t) <= 0.6 && (best === null || Math.abs(mid - t) < Math.abs(best - t))) best = mid;
  }
  return best ?? t;
}

/** For each script character, the index of the heard character it aligns to (or -1). */
function align(a, b) {
  const n = a.length, m = b.length;
  const d = Array.from({ length: n + 1 }, (_, i) => Int32Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) d[i][j] = Math.min(d[i - 1][j - 1] + (a[i - 1] === b[j - 1].c ? 0 : 1), d[i - 1][j] + 1, d[i][j - 1] + 1);
  const map = new Array(n).fill(-1);
  for (let i = n, j = m; i > 0 && j > 0; ) {
    if (d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1].c ? 0 : 1)) map[--i] = --j;
    else if (d[i][j] === d[i - 1][j] + 1) i--;
    else j--;
  }
  return map;
}

for (const id of ids) {
  const lines = script[id];
  const b = heard(id);
  const a = lines.map(norm).join('');
  const map = align(a, b);
  const near = (i, dir) => {
    for (let k = i; k >= 0 && k < map.length; k += dir) if (map[k] >= 0) return b[map[k]];
    return dir > 0 ? b[0] : b.at(-1);
  };
  const gaps = pauses(id);
  let pos = 0;
  const timing = lines.map((text) => {
    const len = norm(text).length;
    const t = { text, start: near(pos, 1).from, end: near(pos + len - 1, -1).to };
    pos += len;
    return t;
  });
  // cut between lines inside a pause, so each line can be played on its own
  for (let k = 1; k < timing.length; k++) {
    const cut = snap((timing[k - 1].end + timing[k].start) / 2, gaps);
    timing[k - 1].end = cut;
    timing[k].start = cut;
  }
  // whisper can place the last word past the end of the file
  const length = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', root(`public/vo/${id}.mp3`)], { encoding: 'utf8' }));
  for (const t of timing) t.end = Math.min(t.end, length);
  fs.writeFileSync(root(`public/vo/${id}.json`), JSON.stringify(timing, null, 1));
  console.log(`${id.padEnd(12)} ${timing.map((t) => `${t.start.toFixed(1)}–${t.end.toFixed(1)}`).join('  ')}`);
}
