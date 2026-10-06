// Scene 8: dispatch a big replay swarm from the Dispatch page and watch it fill.
import fs from 'node:fs';
import { glide, launch, record, scrollBy, SITE } from './browser.mjs';

const REPO = process.env.REPO ?? 'demo/formula-engine';
const AGENTS = Number(process.env.AGENTS ?? 16);
const NAME = process.argv[2] ?? 'scale';
const base = `${SITE}/${REPO}`;
const api = (page, path) => page.evaluate(async (u) => (await fetch(u, { credentials: 'include' })).json(), `/v1/repos/${REPO}${path}`);

const { ctx, page } = await launch();
await page.goto(`${base}/dispatch`);
await page.waitForLoadState('networkidle');
const rec = await record(page, NAME);
const events = [];
const log = (e, extra = {}) => { events.push({ e, t: (Date.now() - rec.startedAt) / 1000, at: Date.now(), ...extra }); console.log(JSON.stringify(events.at(-1))); fs.writeFileSync(`rec/${NAME}.events.json`, JSON.stringify(events, null, 1)); };
log('start');
await page.waitForTimeout(1500);
await glide(page, page.getByRole('button', { name: '+ first 40' }));
await page.waitForTimeout(1500);
const worker = page.locator('select[aria-label="Worker"]').first();
await glide(page, worker, { click: false });
await worker.selectOption('scripted');
await page.waitForTimeout(1200);
const more = page.getByRole('button', { name: 'More agents' });
await glide(page, more, { click: false });
for (let n = 8; n < AGENTS; n++) { await more.click(); await page.waitForTimeout(120); }
await page.waitForTimeout(1200);
await glide(page, page.getByRole('button', { name: /^Launch / }));
await page.waitForURL(/\/swarms\//, { timeout: 30000 });
const id = page.url().split('/swarms/')[1];
const swarmUrl = page.url();
log('launched', { id });

let sawMain = false;
const deadline = Date.now() + 12 * 60_000;
for (;;) {
  await page.waitForTimeout(3000);
  const s = await api(page, `/swarms/${id}`);
  if (!sawMain && s.counts.landed >= 15) {
    sawMain = true;
    await glide(page, page.getByRole('link', { name: /^Main/ }).first());
    log('main-tab', { landed: s.counts.landed });
    await page.waitForTimeout(8000);
    await scrollBy(page, 600, 2500);
    await page.waitForTimeout(2000);
    await page.goto(swarmUrl);
  }
  if (s.status === 'finished' || s.status === 'stopped' || Date.now() > deadline) { log('finished', { counts: s.counts, status: s.status }); break; }
}
await page.waitForTimeout(6000);
await glide(page, page.getByRole('link', { name: /^Main/ }).first());
await page.waitForTimeout(6000);
const done = await rec.stop();
log('stop', done);
await ctx.close();
