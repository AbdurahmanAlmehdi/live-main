import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** Where `lm` keeps its sign-ins: one token per Live Main host (file mode 600). */
export interface Config {
  /** the host commands use unless --host says otherwise */
  host?: string;
  hosts: Record<string, { token: string; person: string }>;
}

export const CONFIG_PATH = process.env.LM_CONFIG ?? join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'livemain', 'config.json');

export function loadConfig(): Config {
  try {
    const c = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as Partial<Config>;
    return { host: c.host, hosts: c.hosts ?? {} };
  } catch {
    return { hosts: {} };
  }
}

export function saveConfig(c: Config): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_PATH, `${JSON.stringify(c, null, 2)}\n`, { mode: 0o600 });
}

/** `https://x.example/` → `https://x.example`; a bare host gets https (http for localhost). */
export function normalizeHost(host: string): string {
  const withScheme = /^https?:\/\//.test(host) ? host : `${/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https'}://${host}`;
  return new URL(withScheme).origin;
}
