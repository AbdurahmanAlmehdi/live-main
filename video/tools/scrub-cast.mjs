// Removes UI clutter from a Claude Code cast (promo, usage warning, tmux hint) and trims the exit.
import fs from 'node:fs';
const [src, out] = process.argv.slice(2);
const lines = fs.readFileSync(src, 'utf8').trim().split('\n');
const blank = (s) => s.replace(/[^\s]/g, ' ');
const kept = [lines[0]];
for (const x of lines.slice(1)) {
  const e = JSON.parse(x);
  let s = e[2];
  if (s.includes('Press Ctrl-C again')) break;
  s = s.replace(/\x1b\[38;5;174m▎\x1b\[3GYour[\s\S]*?Start now\x1b\[39m\x1b\]8;;\x07/, (m) => m.replace(/\x1b\[38;5;174m▎\x1b\[3GYour[^\r]*/, '').replace(/\x1b\[38;5;174m▎\x1b\[3G\x1b\[39mTake[\s\S]*/, ''));
  s = s.replace(/\x1b\[42G\x1b\[38;5;220mYou've\x1b[\s\S]*?\(Africa\/Tripoli\)/, '');
  s = s.replace(/You've used [^\x1b]*\(Africa\/Tripoli\)/, blank);
  s = s.replace(/tmux focus-events off[^\x1b]*tracking/, blank);
  s = s.replace(/\x1b\[17G\x1b\[38;5;246mtmux[\s\S]*?tracking/, '');
  e[2] = s;
  kept.push(JSON.stringify(e));
}
fs.writeFileSync(out, kept.join('\n') + '\n');
