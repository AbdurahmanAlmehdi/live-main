// Build the dashboard into dist/: bundle src/main.ts, copy index.html + styles.css, and copy the
// task bank (bench/tasks.json only; reference solutions never ship with the dashboard).
// `--dev` rebuilds on change and serves dist/ (open /?mock=1 for the simulated race).
import { context, build } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, rmSync, watch } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(here, 'dist');
const tasks = join(here, '../../bench/tasks.json');
const dev = process.argv.includes('--dev');
const portArg = process.argv.indexOf('--port');
const port = portArg >= 0 ? Number(process.argv[portArg + 1]) : 5180;

function copyStatic() {
  mkdirSync(join(dist, 'bench'), { recursive: true });
  copyFileSync(join(here, 'index.html'), join(dist, 'index.html'));
  copyFileSync(join(here, 'src/styles.css'), join(dist, 'styles.css'));
  if (existsSync(tasks)) copyFileSync(tasks, join(dist, 'bench/tasks.json'));
  else console.warn('warning: bench/tasks.json not found; live mode will show an empty grid (mock mode is unaffected)');
}

const options = {
  entryPoints: [join(here, 'src/main.ts')],
  outfile: join(dist, 'app.js'),
  bundle: true,
  format: 'esm',
  target: 'es2022',
  sourcemap: true,
  minify: !dev,
  legalComments: 'none',
  logLevel: 'info',
};

rmSync(dist, { recursive: true, force: true });
copyStatic();

if (!dev) {
  await build(options);
} else {
  const ctx = await context(options);
  await ctx.watch();
  for (const f of ['index.html', 'src/styles.css']) watch(join(here, f), () => copyStatic());
  const { port: actual } = await ctx.serve({ servedir: dist, port, fallback: join(dist, 'index.html') });
  console.log(`dashboard dev server: http://localhost:${actual}/?mock=1`);
}
