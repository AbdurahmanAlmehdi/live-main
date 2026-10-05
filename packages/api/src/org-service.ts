import { createProvider, type ModelProvider } from '@livemain/agent';
import { one, type SqlStore } from '@livemain/core';
import { PROVIDERS, type CreatedGitToken, type CreateRepoRequest, type DeviceCode, type DeviceTokenResponse, type GitToken, type KeyInfo, type ProviderId, type Repo, type Session, type SetKeyRequest } from '@livemain/protocol';
import { ApiError, notFound } from './errors.js';
import type { ModelKeys, OrgDeps, RepoRecord, Template } from './ports.js';
import { ORG_SCHEMA } from './schema.js';
import { repoRecord, type RepoRow } from './views.js';

const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const DEVICE_TTL_MS = 10 * 60_000;

interface KeyRow extends Record<string, string | number | null> {
  provider: string;
  base_url: string | null;
  sealed: string;
  last4: string;
  added_at: number;
  test: string | null;
}

interface TokenRow extends Record<string, string | number | null> {
  id: string;
  person: string;
  name: string;
  hash: string;
  last4: string;
  created_at: number;
  last_used_at: number | null;
}

function tokenView(r: TokenRow): GitToken {
  return { id: r.id, name: r.name, person: r.person, last4: r.last4, createdAt: r.created_at, lastUsedAt: r.last_used_at };
}

async function sha256(s: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * The org: its repository index, model keys, session and templates. A Durable Object
 * (OrgDO) on Cloudflare; in process locally. Repositories themselves are reached through
 * the RepoHost port.
 */
export class OrgService implements ModelKeys {
  private readonly sql: SqlStore;
  private readonly now: () => number;

  constructor(private readonly d: OrgDeps) {
    this.sql = d.sql;
    this.sql.script(ORG_SCHEMA);
    this.now = d.now ?? (() => Date.now());
  }

  /** The session as `actor` sees it (the signed-in person on hosted installs). */
  session(actor?: string): Session {
    return actor ? { ...this.d.session, user: { login: actor, name: actor } } : this.d.session;
  }

  templates() {
    return this.d.templates.map((t) => ({ id: t.id, name: t.name, description: t.description, tasks: t.tasks.length, scripted: typeof t.solution === 'function' }));
  }

  template(id: string | null): Template | undefined {
    return id ? this.d.templates.find((t) => t.id === id) : undefined;
  }

  // ------------------------------------------------------------------ repositories

  records(): RepoRecord[] {
    return this.sql.all<RepoRow>(`SELECT * FROM repos ORDER BY created_at DESC`).map(repoRecord);
  }

  record(owner: string, name: string): RepoRecord {
    const row = one(this.sql.all<RepoRow>(`SELECT * FROM repos WHERE owner = ? AND name = ?`, owner, name));
    if (!row) throw notFound(`repository ${owner}/${name}`);
    return repoRecord(row);
  }

  async listRepos(): Promise<Repo[]> {
    return Promise.all(this.records().map((r) => this.d.repos.view(r)));
  }

  async createRepo(req: CreateRepoRequest): Promise<Repo> {
    const owner = this.d.session.org;
    if (typeof req.name !== 'string' || !req.from || typeof req.from !== 'object') throw new ApiError(400, 'bad-request', 'Give the repository a name and a source.');
    if (!NAME.test(req.name)) throw new ApiError(400, 'bad-name', 'Use letters, digits, dot, dash or underscore (up to 64).');
    if (one(this.sql.all(`SELECT id FROM repos WHERE owner = ? AND name = ?`, owner, req.name))) throw new ApiError(409, 'exists', `${owner}/${req.name} already exists`);
    if (req.from.kind === 'github') {
      throw new ApiError(501, 'github-not-configured', 'Connecting a GitHub repository needs the Live Main GitHub App, which this installation has not set up yet. Import it by URL instead.');
    }
    const template = req.from.kind === 'template' ? this.template(req.from.template) : undefined;
    if (req.from.kind === 'template' && !template) throw new ApiError(400, 'unknown-template', `no template ${req.from.template}`);

    const id = `${owner}.${req.name}`;
    const description = req.description ?? template?.description ?? '';
    const { remote, cloneUrl } = await this.d.git.create(id);
    let sha: string;
    let title = 'Initial commit';
    if (req.from.kind === 'import') {
      sha = await this.d.git.importUrl(id, req.from.url);
      title = `Imported from ${req.from.url}`;
    } else if (template?.seed.kind === 'dir') {
      sha = (await this.d.integrator.seed(remote, template.seed.dir, `Initial commit: ${template.name}`)).sha;
    } else {
      const files = template?.seed.kind === 'files' ? template.seed.files : { 'README.md': `# ${req.name}\n${description ? `\n${description}\n` : ''}` };
      sha = await this.d.git.initialCommit(id, files, 'Initial commit');
    }
    const source = req.from.kind === 'import' ? { kind: 'imported', url: req.from.url } : { kind: 'hosted' };
    this.sql.all(
      `INSERT INTO repos (id, owner, name, description, source, template, remote, clone_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      owner,
      req.name,
      description,
      JSON.stringify(source),
      template?.id ?? null,
      remote,
      cloneUrl,
      this.now(),
    );
    const record = this.record(owner, req.name);
    await this.d.repos.init(record, { sha, title, tasks: template?.tasks ?? [] });
    return this.d.repos.view(record);
  }

  // ------------------------------------------------------------------ git tokens

  tokens(person: string): GitToken[] {
    return this.sql.all<TokenRow>(`SELECT * FROM git_tokens WHERE person = ? ORDER BY created_at DESC`, person).map(tokenView);
  }

  async createToken(person: string, name: string): Promise<CreatedGitToken> {
    const label = typeof name === 'string' ? name.trim().slice(0, 64) : '';
    if (!label) throw new ApiError(400, 'bad-name', 'Name the token (e.g. the machine it is for).');
    const token = `lm_${base64url(crypto.getRandomValues(new Uint8Array(24)))}`;
    const id = base64url(crypto.getRandomValues(new Uint8Array(9)));
    this.sql.all(`INSERT INTO git_tokens (id, person, name, hash, last4, created_at) VALUES (?, ?, ?, ?, ?, ?)`, id, person, label, await sha256(token), token.slice(-4), this.now());
    return { token, info: tokenView(one(this.sql.all<TokenRow>(`SELECT * FROM git_tokens WHERE id = ?`, id))!) };
  }

  revokeToken(person: string, id: string): void {
    if (this.sql.all(`DELETE FROM git_tokens WHERE id = ? AND person = ? RETURNING id`, id, person).length === 0) throw notFound(`token ${id}`);
  }

  /** The person a git token belongs to, or null. */
  async verifyToken(token: string): Promise<string | null> {
    if (!token.startsWith('lm_')) return null;
    const row = one(this.sql.all<TokenRow>(`SELECT * FROM git_tokens WHERE hash = ?`, await sha256(token)));
    if (!row) return null;
    this.sql.all(`UPDATE git_tokens SET last_used_at = ? WHERE id = ?`, this.now(), row.id);
    return row.person;
  }

  // ------------------------------------------------------------------ device login (lm auth login)

  /** Start a device login: the CLI shows the user code and polls with the device code. */
  async startDevice(origin: string): Promise<DeviceCode> {
    const deviceCode = base64url(crypto.getRandomValues(new Uint8Array(24)));
    const letters = 'BCDFGHJKLMNPQRSTVWXZ';
    const pick = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => letters[b % letters.length]).join('');
    const userCode = `${pick()}-${pick()}`;
    this.sql.all(`DELETE FROM device_codes WHERE expires_at < ?`, this.now());
    this.sql.all(`INSERT INTO device_codes (device_hash, user_code, status, expires_at) VALUES (?, ?, 'pending', ?)`, await sha256(deviceCode), userCode, this.now() + DEVICE_TTL_MS);
    return { deviceCode, userCode, verificationUrl: `${origin}/device?code=${userCode}`, expiresIn: DEVICE_TTL_MS / 1000, interval: 3 };
  }

  /** The signed-in person approves a device: it gets a git token of its own. */
  async approveDevice(person: string, userCode: string): Promise<{ ok: true }> {
    const code = typeof userCode === 'string' ? userCode.trim().toUpperCase() : '';
    const row = one(this.sql.all<{ device_hash: string; status: string; expires_at: number }>(`SELECT device_hash, status, expires_at FROM device_codes WHERE user_code = ?`, code));
    if (!row || row.expires_at < this.now()) throw new ApiError(404, 'unknown-code', 'That code is unknown or expired. Run `lm auth login` again.');
    if (row.status !== 'pending') throw new ApiError(409, 'already-approved', 'This device is already signed in.');
    const { token } = await this.createToken(person, `lm CLI (${new Date(this.now()).toISOString().slice(0, 10)})`);
    this.sql.all(`UPDATE device_codes SET status = 'approved', person = ?, sealed_token = ? WHERE device_hash = ?`, person, await this.d.vault.seal(token), row.device_hash);
    return { ok: true };
  }

  /** The CLI's poll: the token once approved (handed out once). */
  async pollDevice(deviceCode: string): Promise<DeviceTokenResponse> {
    const hash = await sha256(typeof deviceCode === 'string' ? deviceCode : '');
    const row = one(this.sql.all<{ status: string; person: string | null; sealed_token: string | null; expires_at: number }>(`SELECT status, person, sealed_token, expires_at FROM device_codes WHERE device_hash = ?`, hash));
    if (!row || row.expires_at < this.now()) return { status: 'expired' };
    if (row.status !== 'approved' || !row.sealed_token || !row.person) return { status: 'pending' };
    this.sql.all(`DELETE FROM device_codes WHERE device_hash = ?`, hash);
    return { status: 'approved', token: await this.d.vault.open(row.sealed_token), person: row.person };
  }

  // ------------------------------------------------------------------ model keys

  private keyRow(provider: ProviderId): KeyRow | undefined {
    return one(this.sql.all<KeyRow>(`SELECT * FROM keys WHERE provider = ?`, provider));
  }

  private keyView(k: KeyRow): KeyInfo {
    return { provider: k.provider as ProviderId, baseUrl: k.base_url, last4: k.last4, addedAt: k.added_at, test: k.test ? (JSON.parse(k.test) as KeyInfo['test']) : null };
  }

  keys(): KeyInfo[] {
    return this.sql.all<KeyRow>(`SELECT * FROM keys ORDER BY provider`).map((k) => this.keyView(k));
  }

  async setKey(req: SetKeyRequest): Promise<KeyInfo> {
    if (!(req.provider in PROVIDERS)) throw new ApiError(400, 'bad-provider', `unknown provider ${req.provider}`);
    const key = req.key?.trim();
    if (!key || key.length < 8) throw new ApiError(400, 'bad-key', 'Paste the full API key.');
    if (req.provider === 'openai-compatible' && !req.baseUrl) throw new ApiError(400, 'bad-base-url', 'An OpenAI-compatible endpoint needs its base URL.');
    const sealed = await this.d.vault.seal(key);
    this.sql.all(`INSERT OR REPLACE INTO keys (provider, base_url, sealed, last4, added_at, test) VALUES (?, ?, ?, ?, ?, NULL)`, req.provider, req.baseUrl ?? null, sealed, key.slice(-4), this.now());
    return this.testKey(req.provider);
  }

  async testKey(provider: ProviderId): Promise<KeyInfo> {
    if (!this.keyRow(provider)) throw notFound(`${provider} key`);
    let test: NonNullable<KeyInfo['test']>;
    try {
      const models = await (await this.provider(provider)).listModels();
      test = { at: this.now(), ok: true, message: `${models.length} models available`, models: models.slice(0, 200) };
    } catch (err) {
      test = { at: this.now(), ok: false, message: err instanceof Error ? err.message.slice(0, 300) : String(err), models: [] };
    }
    this.sql.all(`UPDATE keys SET test = ? WHERE provider = ?`, JSON.stringify(test), provider);
    return this.keyView(this.keyRow(provider)!);
  }

  deleteKey(provider: ProviderId): void {
    this.sql.all(`DELETE FROM keys WHERE provider = ?`, provider);
  }

  /** The sealed key for a provider, for runtimes that decrypt it where the agent runs. */
  sealedKey(provider: ProviderId): { sealed: string; baseUrl: string | null } | null {
    const k = this.keyRow(provider);
    return k ? { sealed: k.sealed, baseUrl: k.base_url } : null;
  }

  async missing(wanted: ProviderId[]): Promise<ProviderId[]> {
    return wanted.filter((p) => !this.keyRow(p));
  }

  async provider(id: ProviderId): Promise<ModelProvider> {
    const k = this.keyRow(id);
    if (!k) throw new ApiError(400, 'missing-key', `no ${PROVIDERS[id].label} key`);
    return createProvider({ provider: id, apiKey: await this.d.vault.open(k.sealed), baseUrl: k.base_url });
  }
}
