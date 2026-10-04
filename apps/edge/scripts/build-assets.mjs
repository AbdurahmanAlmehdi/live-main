// Assemble the Worker's static assets: the web app at the root, the benchmark dashboard under
// /dashboard/ (its app.js and styles.css stay at the root, where its page loads them), the task
// bank and reference solutions (only scripted agents read them; LLM agents have no access).
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const out = join(root, 'apps/edge/public');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'bench'), { recursive: true });
const web = join(root, 'apps/web/dist');
if (!existsSync(web)) throw new Error('build the web app first: pnpm --filter @livemain/web build');
cpSync(web, out, { recursive: true });
const dash = join(root, 'apps/dashboard/dist');
if (existsSync(dash)) {
  for (const f of readdirSync(dash)) {
    if (f === 'index.html') continue;
    cpSync(join(dash, f), join(out, f), { recursive: true });
  }
  mkdirSync(join(out, 'dashboard'), { recursive: true });
  cpSync(join(dash, 'index.html'), join(out, 'dashboard/index.html'));
}
cpSync(join(root, 'bench/tasks.json'), join(out, 'bench/tasks.json'));
cpSync(join(root, 'bench/solutions'), join(out, 'bench/solutions'), { recursive: true });
console.log(`assets → ${out}`);
