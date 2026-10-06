// Voices src/voiceover.json with ElevenLabs: public/vo/<scene>.mp3 plus <scene>.json, the start and
// end second of each caption line (from the API's character timestamps).
//
//   node tools/tts.mjs                  every scene that has no audio yet
//   node tools/tts.mjs idea outro       just these scenes (re-voices them)
//   node tools/tts.mjs --voices         list the voices on your account
//
// Reads ELEVENLABS_API_KEY (and optionally ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL) from the
// environment or video/.env.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
try {
  for (const line of fs.readFileSync(root('.env'), 'utf8').split('\n')) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch {
  // no .env
}

const KEY = process.env.ELEVENLABS_API_KEY;
const VOICE = process.env.ELEVENLABS_VOICE_ID ?? 'nPczCjzI2devNBz1zQrb'; // "Brian", a premade narration voice
const MODEL = process.env.ELEVENLABS_MODEL ?? 'eleven_v4';
const API = 'https://api.elevenlabs.io/v1';
if (!KEY) {
  console.error('Set ELEVENLABS_API_KEY (in video/.env or the environment).');
  process.exit(1);
}

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { 'xi-api-key': KEY, 'content-type': 'application/json', ...init.headers } });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

const args = process.argv.slice(2);
if (args.includes('--voices')) {
  const { voices } = await api('/voices');
  for (const v of voices) console.log(`${v.voice_id}  ${v.name.padEnd(28)} ${[v.labels?.accent, v.labels?.gender, v.labels?.use_case ?? v.labels?.description].filter(Boolean).join(' · ')}`);
  process.exit(0);
}

const script = JSON.parse(fs.readFileSync(root('src/voiceover.json'), 'utf8'));
const ids = Object.keys(script);
const wanted = args.length ? args : ids.filter((id) => !fs.existsSync(root(`public/vo/${id}.mp3`)));
for (const id of wanted) if (!script[id]) throw new Error(`no scene ${id} (scenes: ${ids.join(', ')})`);
fs.mkdirSync(root('public/vo'), { recursive: true });

for (const id of wanted) {
  const lines = script[id];
  const text = lines.join(' ');
  const i = ids.indexOf(id);
  const out = await api(`/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    body: JSON.stringify({
      text,
      model_id: MODEL,
      // neighbouring scenes keep the delivery continuous across files
      previous_text: i > 0 ? script[ids[i - 1]].join(' ') : undefined,
      next_text: i < ids.length - 1 ? script[ids[i + 1]].join(' ') : undefined,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true },
    }),
  });
  fs.writeFileSync(root(`public/vo/${id}.mp3`), Buffer.from(out.audio_base64, 'base64'));
  // caption timing: each line spans its first to last character
  const a = out.alignment;
  const timing = [];
  let pos = 0;
  for (const line of lines) {
    const start = pos;
    const end = pos + line.length - 1;
    timing.push({ text: line, start: a.character_start_times_seconds[start] ?? 0, end: a.character_end_times_seconds[Math.min(end, a.characters.length - 1)] ?? 0 });
    pos += line.length + 1;
  }
  fs.writeFileSync(root(`public/vo/${id}.json`), JSON.stringify(timing, null, 1));
  console.log(`${id}: ${timing.at(-1).end.toFixed(1)} s`);
}
