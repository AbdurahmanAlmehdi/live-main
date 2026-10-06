import { loadConfig, normalizeHost } from './config.js';

export class CliError extends Error {
  constructor(
    message: string,
    readonly code = 'error',
    readonly status = 0,
  ) {
    super(message);
  }
}

/** The Live Main API as the CLI reaches it: /cli/v1 with the host's token. */
export class Client {
  constructor(
    readonly host: string,
    private readonly token: string | null,
  ) {}

  /** The signed-in client for `host` (or the default host). */
  static fromConfig(host?: string): Client {
    const c = loadConfig();
    const h = host ? normalizeHost(host) : (process.env.LM_HOST ? normalizeHost(process.env.LM_HOST) : c.host);
    if (!h) throw new CliError('Not signed in. Run `lm auth login --host <url>`.', 'not-signed-in');
    const token = process.env.LM_TOKEN ?? c.hosts[h]?.token ?? null;
    if (!token) throw new CliError(`Not signed in to ${h}. Run \`lm auth login --host ${h}\`.`, 'not-signed-in');
    return new Client(h, token);
  }

  async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.host}/cli${path.startsWith('/device/') ? '' : '/v1'}${path}`, {
      method,
      headers: { ...(this.token ? { authorization: `Bearer ${this.token}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
    if (!res.ok) {
      const err = (parsed ?? {}) as { error?: string; message?: string };
      throw new CliError(err.message ?? `${method} ${path}: HTTP ${res.status}${text && !parsed ? ` (${text.slice(0, 200)})` : ''}`, err.error ?? 'http-error', res.status);
    }
    return parsed as T;
  }

  repo(repo: string): string {
    const [owner, name] = repo.split('/');
    return `/repos/${encodeURIComponent(owner!)}/${encodeURIComponent(name!)}`;
  }
}
