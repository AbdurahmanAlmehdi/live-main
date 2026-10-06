// Opens the recording browser on the site; you sign in through Cloudflare Access, then it closes.
import { launch, SITE } from './browser.mjs';

const { ctx, page } = await launch({ headless: false });
await page.goto(SITE);
console.log('Sign in through Cloudflare Access in the browser window…');
for (let i = 0; i < 600; i++) {
  const ok = await page
    .evaluate(async () => (await fetch('/v1/session', { credentials: 'include' })).ok)
    .catch(() => false);
  if (ok && new URL(page.url()).origin === new URL(SITE).origin) {
    console.log('Signed in.');
    break;
  }
  await page.waitForTimeout(1000);
}
await ctx.close();
