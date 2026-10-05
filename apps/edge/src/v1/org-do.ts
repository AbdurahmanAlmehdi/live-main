import { DurableObject } from 'cloudflare:workers';
import { handleOrg, json, OrgService, type RepoHost, type RepoRecord } from '@livemain/api';
import type { ProviderId, Repo, Task } from '@livemain/protocol';
import { doSqlStore } from '../do-sql.js';
import type { Env } from '../env.js';
import { gitHost, integrator, session, templates, vault } from './platform.js';

/** Repositories live in their own Durable Objects; the org reaches them by RPC. */
class RepoStubs implements RepoHost {
  constructor(private readonly env: Env) {}
  private stub(record: RepoRecord) {
    return this.env.REPO.get(this.env.REPO.idFromName(record.id));
  }
  async init(record: RepoRecord, seed: { sha: string; title: string; tasks: Task[] }): Promise<void> {
    await this.stub(record).init(record, seed);
  }
  async view(record: RepoRecord): Promise<Repo> {
    return this.stub(record).view();
  }
}

/** The org (one per install until accounts land): repository index, model keys, templates. */
export class OrgDO extends DurableObject<Env> {
  private svc: Promise<OrgService> | null = null;

  private service(): Promise<OrgService> {
    this.svc ??= templates(this.env).then(
      (tpls) =>
        new OrgService({
          sql: doSqlStore(this.ctx.storage),
          git: gitHost(this.env),
          integrator: integrator(this.env),
          vault: vault(this.env),
          templates: tpls,
          session: session(this.env),
          repos: new RepoStubs(this.env),
        }),
    );
    return this.svc;
  }

  override async fetch(request: Request): Promise<Response> {
    return (await handleOrg(await this.service(), request)) ?? json({ error: 'not-found', message: `no route ${request.method} ${new URL(request.url).pathname}` }, 404);
  }

  /** RPC from repositories: the providers in `wanted` that have no key. */
  async missingKeys(wanted: ProviderId[]): Promise<ProviderId[]> {
    return (await this.service()).missing(wanted);
  }

  /** RPC from the Worker: the person a git token belongs to, or null. */
  async verifyToken(token: string): Promise<string | null> {
    return (await this.service()).verifyToken(token);
  }

  /** RPC from agents: a sealed key; the agent decrypts it with the platform key. */
  async sealedKey(provider: ProviderId): Promise<{ sealed: string; baseUrl: string | null } | null> {
    return (await this.service()).sealedKey(provider);
  }
}
