// The recording browser: Chrome with a persistent profile (so the Cloudflare Access sign-in
// survives), a visible fake cursor, and a CDP screencast piped into ffmpeg.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const SITE = process.env.LM_SITE ?? 'https://live-main.abdurahman-i-work.workers.dev';
const PROFILE = fileURLToPath(new URL('../.profile', import.meta.url));
export const REC_DIR = fileURLToPath(new URL('../public/rec/', import.meta.url));

/** 1536×864 CSS px at 1.25× = 1920×1080 frames with slightly larger UI. */
const VIEWPORT = { width: 1536, height: 864 };
const SCALE = 1.25;
const FPS = 30;

const CURSOR = `
(() => {
  if (window.__lmCursor) return;
  window.__lmCursor = true;
  const install = () => {
    const c = document.createElement('div');
    c.id = '__lm_cursor';
    c.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;transition:transform 40ms linear;transform:translate(-100px,-100px)';
    c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l15 11-7 1-3 7z" fill="#1F1D1A" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(c);
    addEventListener('mousemove', (e) => { c.style.transform = 'translate(' + (e.clientX - 3) + 'px,' + (e.clientY - 2) + 'px)'; }, true);
    addEventListener('mousedown', (e) => {
      const r = document.createElement('div');
      r.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;border-radius:50%;border:2px solid #0C6A73;width:10px;height:10px;left:' + (e.clientX - 5) + 'px;top:' + (e.clientY - 5) + 'px;transition:all 450ms ease-out;opacity:.9';
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = 'scale(5)'; r.style.opacity = '0'; });
      setTimeout(() => r.remove(), 500);
    }, true);
  };
  if (document.documentElement) install(); else addEventListener('DOMContentLoaded', install);
})();`;

export async function launch({ headless = true } = {}) {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome',
    headless,
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    colorScheme: 'light',
  });
  await ctx.addInitScript(CURSOR);
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  return { ctx, page };
}

/** Record the page until `stop()`; returns the path. Frames repeat at a fixed rate. */
export async function record(page, name) {
  const out = `${REC_DIR}${name}.mp4`;
  const cdp = await page.context().newCDPSession(page);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  let latest = null;
  cdp.on('Page.screencastFrame', (f) => {
    latest = Buffer.from(f.data, 'base64');
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => undefined);
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
  const started = Date.now();
  let written = 0;
  const tick = setInterval(() => {
    if (!latest) return;
    // keep wall-clock timing even if the timer drifts
    const due = Math.floor(((Date.now() - started) / 1000) * FPS);
    while (written < due) {
      ff.stdin.write(latest);
      written++;
    }
  }, 1000 / FPS / 2);
  return {
    startedAt: started,
    async stop() {
      clearInterval(tick);
      await cdp.send('Page.stopScreencast').catch(() => undefined);
      ff.stdin.end();
      await new Promise((r) => ff.on('close', r));
      return { path: out, seconds: written / FPS, startedAt: started };
    },
  };
}

/** Human-ish pointer: glide to the element's centre, pause, click. */
export async function glide(page, locator, { click = true, pause = 350 } = {}) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`no box for ${locator}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 });
  await page.waitForTimeout(pause);
  if (click) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

export async function typeSlow(page, text, delay = 55) {
  await page.keyboard.type(text, { delay });
}

/** Smooth scroll by `dy` CSS px over `ms`. */
export async function scrollBy(page, dy, ms = 1200) {
  await page.evaluate(([dy, ms]) => new Promise((r) => { window.scrollBy({ top: dy, behavior: 'smooth' }); setTimeout(r, ms); }), [dy, ms]);
}
