import type { Repo, Task } from '@livemain/protocol';
import { OrgService } from './org-service.js';
import type { Platform, RepoHost, RepoRecord, SwarmRunner } from './ports.js';
import { RepoService } from './repo-service.js';

/** The API as the router sees it: one org and its repositories. */
export interface V1Api {
  org: OrgService;
  repo(owner: string, name: string): Promise<RepoService>;
}

/**
 * Local runtime: the org and every repository in one process, each with its own database
 * (`org`, `repo-<id>`), mirroring the OrgDO / RepoDO split on Cloudflare.
 */
export class LocalApi implements V1Api, RepoHost {
  readonly org: OrgService;
  private readonly repos = new Map<string, RepoService>();

  constructor(
    private readonly p: Platform,
    private readonly opts: { thinkMs?: number; runner?: SwarmRunner } = {},
  ) {
    this.org = new OrgService({ sql: p.sql('org'), git: p.git, integrator: p.integrator, vault: p.vault, templates: p.templates, session: p.session, repos: this, now: p.now });
  }

  private service(record: RepoRecord): RepoService {
    let repo = this.repos.get(record.id);
    if (!repo) {
      repo = new RepoService({
        record,
        sql: this.p.sql(`repo-${record.id}`),
        git: this.p.git,
        integrator: this.p.integrator,
        workcells: this.p.workcells,
        template: this.org.template(record.template),
        keys: this.org,
        runner: this.opts.runner,
        now: this.p.now,
        user: this.org.session().user.login,
        log: this.p.log,
        thinkMs: this.opts.thinkMs,
      });
      this.repos.set(record.id, repo);
    }
    return repo;
  }

  async repo(owner: string, name: string): Promise<RepoService> {
    return this.service(this.org.record(owner, name));
  }

  async init(record: RepoRecord, seed: { sha: string; title: string; tasks: Task[] }): Promise<void> {
    this.service(record).init(seed);
  }

  async view(record: RepoRecord): Promise<Repo> {
    return this.service(record).view();
  }

  async close(): Promise<void> {
    await Promise.allSettled([...this.repos.values()].map((r) => r.close()));
  }
}
