import { execFileSync, spawn } from 'node:child_process';
import type { DeviceCode, DeviceTokenResponse, Session } from '@livemain/protocol';
import { CliError, Client } from './client.js';
import { CONFIG_PATH, loadConfig, normalizeHost, saveConfig } from './config.js';

/** `lm auth login`: device login. Shows a code, opens the browser, waits for approval. */
export async function login(hostArg: string | undefined, log: (s: string) => void, browser = true): Promise<void> {
  const config = loadConfig();
  const raw = hostArg ?? process.env.LM_HOST ?? config.host;
  if (!raw) throw new CliError('Which Live Main? Run `lm auth login --host https://<your-host>`.');
  const host = normalizeHost(raw);
  const anon = new Client(host, null);
  const start = await anon.call<DeviceCode>('POST', '/device/code');
  log(`First copy your one-time code: ${start.userCode}`);
  log(`Then approve this device at ${start.verificationUrl}`);
  if (browser) openBrowser(start.verificationUrl);
  const deadline = Date.now() + start.expiresIn * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, start.interval * 1000));
    const res = await anon.call<DeviceTokenResponse>('POST', '/device/token', { deviceCode: start.deviceCode });
    if (res.status === 'expired') break;
    if (res.status === 'approved') {
      config.hosts[host] = { token: res.token, person: res.person };
      config.host = host;
      saveConfig(config);
      log(`Signed in to ${host} as ${res.person}.`);
      log('For git over HTTPS with the same token: lm auth setup-git');
      return;
    }
  }
  throw new CliError('The code expired before it was approved. Run `lm auth login` again.');
}

export async function status(log: (s: string) => void): Promise<void> {
  const config = loadConfig();
  const hosts = Object.entries(config.hosts);
  if (hosts.length === 0) return log('Not signed in. Run `lm auth login --host <url>`.');
  for (const [host, { person }] of hosts) {
    let state = 'token works';
    try {
      const s = await new Client(host, config.hosts[host]!.token).call<Session>('GET', '/session');
      state = `token works (${s.user.login})`;
    } catch (err) {
      state = `token rejected: ${err instanceof Error ? err.message : String(err)}`;
    }
    log(`${host === config.host ? '* ' : '  '}${host} as ${person}: ${state}`);
  }
  log(`(config: ${CONFIG_PATH})`);
}

export function logout(hostArg: string | undefined, log: (s: string) => void): void {
  const config = loadConfig();
  const host = hostArg ? normalizeHost(hostArg) : config.host;
  if (!host || !config.hosts[host]) return log('Not signed in there.');
  delete config.hosts[host];
  if (config.host === host) config.host = Object.keys(config.hosts)[0];
  saveConfig(config);
  log(`Signed out of ${host}. (Revoke the token in Settings → Git tokens to invalidate it.)`);
}

/** `lm auth setup-git`: git asks `lm` for the token of this host (a credential helper). */
export function setupGit(hostArg: string | undefined, log: (s: string) => void): void {
  const host = Client.fromConfig(hostArg).host;
  execFileSync('git', ['config', '--global', `credential.${host}.helper`, '!lm auth git-credential']);
  log(`git now uses your Live Main token for ${host} (credential.${host}.helper).`);
}

/** The git credential helper protocol: `get` prints the token for a known host. */
export async function gitCredential(op: string | undefined): Promise<void> {
  if (op !== 'get') return;
  const input = await new Promise<string>((resolve) => {
    let data = '';
    process.stdin.on('data', (c) => (data += String(c)));
    process.stdin.on('end', () => resolve(data));
  });
  const fields = Object.fromEntries(input.split('\n').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  if (!fields.protocol || !fields.host) return;
  const entry = loadConfig().hosts[`${fields.protocol}://${fields.host}`];
  if (entry) process.stdout.write(`username=lm\npassword=${entry.token}\n`);
}

function openBrowser(url: string): void {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => undefined).unref();
  } catch {
    // no browser: the URL is printed
  }
}
