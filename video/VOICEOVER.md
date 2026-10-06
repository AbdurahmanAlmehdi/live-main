# Voiceover

The narration is in `src/voiceover.json`, one array of lines per scene. The same lines are
the captions. Each scene stretches to fit its audio, and its animations stretch with it.

## ElevenLabs

1. Put your key in `video/.env` (gitignored):
   ```
   ELEVENLABS_API_KEY=...
   # optional: ELEVENLABS_VOICE_ID=...   (default: Brian, a premade narration voice)
   # optional: ELEVENLABS_MODEL=...      (default: eleven_v4)
   ```
2. Pick a voice: `node tools/tts.mjs --voices`
3. Voice every scene: `node tools/tts.mjs`. This writes `public/vo/<scene>.mp3`, plus
   `<scene>.json` with when each line is spoken, which the captions follow. Only scenes
   without audio are voiced; `node tools/tts.mjs idea outro` re-voices those two after an
   edit.
4. Render: `npm run render` (writes `out/live-main-demo.mp4`, with the narration normalized to -16 LUFS)

## Audio made elsewhere (ElevenLabs website, your own voice)

Free ElevenLabs accounts can't use Library voices through the API, but can on the website.
Generate each scene there (or record it yourself) and save it as `public/vo/<scene>.mp3` (or
`.m4a`). Then find where each line is spoken, using whisper.cpp on this machine:

```bash
brew install whisper-cpp
curl -L -o rec/models/ggml-base.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
node tools/align.mjs            # or: node tools/align.mjs outro
```

This writes the same `public/vo/<scene>.json` as `tts.mjs`, with the cuts between lines
placed in pauses.

## Pacing

Each line plays as its own clip. A scene runs at about 82% of its planned length; the quiet
is shared out evenly between lines, never more than 3 s, so each line lands near the visuals
it describes. The constants are at the top of `src/Demo.tsx`.
