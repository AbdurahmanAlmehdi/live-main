import { authedRemote, type ArtifactsNamespace } from '@livemain/api';
import type { CoordinatorDO } from './coordinator-do.js';
import type { OrgDO } from './v1/org-do.js';
import type { RepoAgentDO } from './v1/repo-agent-do.js';
import type { RepoDO } from './v1/repo-do.js';
import type { RunDO } from './run-do.js';
import type { SwarmAgentDO } from './agent-do.js';
import type { Workcell } from './workcell-do.js';

/** The Artifacts binding's repo results carry a remote and a token. */
export function authedRepoRemote(repo: { remote: string; token: string }): string {
  return authedRemote(repo.remote, repo.token);
}

export interface Env {
  /** API v1: the org (repo index, keys), one object per repository, one per agent */
  ORG: DurableObjectNamespace<OrgDO>;
  REPO: DurableObjectNamespace<RepoDO>;
  REPO_AGENT: DurableObjectNamespace<RepoAgentDO>;
  /** 32-byte base64 key that seals model keys at rest (a Worker secret) */
  LIVEMAIN_MASTER_KEY?: string;
  /** single-tenant install: the org and person everything belongs to (until accounts land) */
  LIVEMAIN_ORG?: string;
  LIVEMAIN_USER?: string;
  /** deployed: every request the Worker handles must carry a valid Cloudflare Access JWT */
  LIVEMAIN_REQUIRE_ACCESS?: string;
  /** the Access team domain (`<team>.cloudflareaccess.com`) and the application's audience tag */
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  /** number of workcell containers per org (default 2) */
  WORKCELLS?: string;
  /** development: workcells and integrator run outside Cloudflare (comma-separated base URLs) */
  WORKCELL_URLS?: string;
  INTEGRATOR_URL?: string;
  /** public clone URL base when using a git server instead of Artifacts */
  GIT_PUBLIC_BASE?: string;
  COORDINATOR: DurableObjectNamespace<CoordinatorDO>;
  WORKCELL: DurableObjectNamespace<Workcell>;
  AGENT: DurableObjectNamespace<SwarmAgentDO>;
  RUN: DurableObjectNamespace<RunDO>;
  ASSETS: Fetcher;
  /** Cloudflare Artifacts: hosts every repository. When absent, GIT_REMOTE_BASE is used. */
  ARTIFACTS?: ArtifactsNamespace;
  /** Fallback git server reachable from containers, e.g. http://host.docker.internal:18090 in local dev */
  GIT_REMOTE_BASE?: string;
  ANTHROPIC_API_KEY?: string;
  WORKER_MODEL?: string;
  /** log every workcell call (debugging) */
  LIVEMAIN_DEBUG?: string;
}
