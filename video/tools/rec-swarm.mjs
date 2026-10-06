// Scenes 5–6: records the app while Claude Code runs a swarm. Sets the protected path, follows
// the new swarm live, approves the helper landing when it waits, then shows the landings.
import fs from 'node:fs';
import { glide, launch, record, SITE, typeSlow } from './browser.mjs';

const REPO = process.env.REPO ?? 'demo/formula-engine';
const NAME = process.argv[2] ?? 'swarm';
const base = `${SITE}/${REPO}`;
const api = (page, path) => page.evaluate(async (u) => (await fetch(u, { credentials: 'include' })).json(), `/v1/repos/${REPO}${path}`);

const { ctx, page } = await launch();
await page.goto(`${base}/settings`);
await page.waitForLoadState('networkidle');
const rec = await record(page, NAME);
const events = [];
const log = (e, extra = {}) => { const ev = { e, t: (Date.now() - rec.startedAt) / 1000, at: Date.now(), ...extra }; events.push(ev); console.log(JSON.stringify(ev)); fs.writeFileSync(`rec/${NAME}.events.json`, JSON.stringify(events, null, 1)); };
log('start');

// protected path
if (!process.env.SKIP_POLICY) {
  const area = page.locator('textarea[aria-label="Protected path globs"]');
  await glide(page, area);
  await page.keyboard.press('Meta+A');
  await typeSlow(page, 'src/helpers/**', 70);
  await page.waitForTimeout(500);
  await glide(page, page.getByRole('button', { name: 'Save policy' }));
  await page.waitForTimeout(2500);
  log('policy');
}

// wait for Claude Code's swarm
const before = new Set((await api(page, '/swarms')).map((s) => s.id));
await glide(page, page.getByRole('link', { name: /Swarms/ }).first());
log('swarms-tab');
let swarm;
for (let i = 0; i < 600 && !swarm; i++) {
  swarm = (await api(page, '/swarms')).find((s) => !before.has(s.id));
  if (!swarm) await page.waitForTimeout(1500);
}
if (!swarm) throw new Error('no swarm appeared');
log('swarm-dispatched', { id: swarm.id });
await page.waitForTimeout(1500);
const row = page.locator(`a[href*="/swarms/${swarm.id}"]`).first();
if (await row.count()) await glide(page, row);
else await page.goto(`${base}/swarms/${swarm.id}`);
const swarmUrl = `${base}/swarms/${swarm.id}`;
log('swarm-page');

const approved = new Set();
let peeked = false;
for (;;) {
  await page.waitForTimeout(2000);
  const s = await api(page, `/swarms/${swarm.id}`);
  const pending = (await api(page, '/approvals?status=pending')).filter((a) => !approved.has(a.id));
  if (pending.length) {
    log('approval-pending', { id: pending[0].id });
    await page.waitForTimeout(5000);
    await glide(page, page.getByRole('link', { name: /Approvals/ }).first());
    await page.waitForTimeout(3000);
    await glide(page, page.getByRole('button', { name: 'Approve' }).first());
    approved.add(pending[0].id);
    log('approved', { id: pending[0].id });
    await page.waitForTimeout(4000);
    await page.goto(swarmUrl);
    continue;
  }
  if (!peeked && s.counts.landed >= 1) {
    // a quick look inside one working agent: its tool calls run in a server-side overlay
    const agents = await api(page, `/agents?swarm=${swarm.id}&active=1`);
    const a = agents.find((x) => x.state === 'working' || x.state === 'testing');
    if (a) {
      peeked = true;
      await glide(page, page.locator(`a[href*="/agents/${encodeURIComponent(a.id)}"]`).first());
      log('agent-page', { id: a.id });
      await page.waitForTimeout(9000);
      await page.goto(swarmUrl);
    }
  }
  if (s.status === 'finished' || s.status === 'stopped') { log('finished', { counts: s.counts }); break; }
}

await page.waitForTimeout(5000);
const landings = await api(page, '/landings?limit=20');
const mine = landings.filter((l) => l.by.kind === 'agent');
const withApproval = mine.find((l) => l.approval);
const merged = mine.find((l) => !l.approval);
for (const l of [withApproval, merged].filter(Boolean)) {
  const link = page.locator(`a[href$="/main/${l.version}"]`).first();
  if (await link.count()) await glide(page, link);
  else await page.goto(`${base}/main/${l.version}`);
  log('landing', { version: l.version, approval: !!l.approval });
  await page.waitForTimeout(7000);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(4000);
  await page.goto(swarmUrl);
  await page.waitForTimeout(2000);
}
const done = await rec.stop();
log('stop', done);
await ctx.close();
