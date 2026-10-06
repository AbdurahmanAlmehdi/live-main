// Scene 3: a short tour of the deployed app.
import { glide, launch, record, scrollBy, SITE } from './browser.mjs';

const { ctx, page } = await launch();
await page.goto(SITE);
await page.waitForLoadState('networkidle');
const rec = await record(page, 'tour');
await page.waitForTimeout(2500);
await glide(page, page.locator('a[href$="/demo/formula-engine"]').first());
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2500);
// the code: open src → core → registry.ts
await glide(page, page.getByText('src', { exact: true }).first());
await page.waitForTimeout(800);
await glide(page, page.getByText('core', { exact: true }).first());
await page.waitForTimeout(800);
await glide(page, page.getByText('registry.ts', { exact: true }).first());
await page.waitForTimeout(4000);
// main: a timeline of versions
await glide(page, page.getByRole('link', { name: /^Main/ }).first());
await page.waitForTimeout(4000);
await scrollBy(page, 500, 2500);
await page.waitForTimeout(1500);
await scrollBy(page, -500, 1200);
// one landing
await glide(page, page.locator('a[href*="/main/"]').nth(2));
await page.waitForTimeout(5000);
// tasks
await glide(page, page.getByRole('link', { name: /^Tasks/ }).first());
await page.waitForTimeout(4000);
await scrollBy(page, 700, 2500);
await page.waitForTimeout(1500);
const done = await rec.stop();
console.log(JSON.stringify(done));
await ctx.close();
