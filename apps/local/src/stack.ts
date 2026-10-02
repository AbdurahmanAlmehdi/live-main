import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { WorkcellClient, type FetchLike } from '@livemain/core';
import { Agent, fetch as undiciFetch } from 'undici';

const exec = promisify(execFile);

export const IMAGE = process.env.LIVEMAIN_IMAGE ?? 'livemain/workcell:dev';
const NETWORK = 'livemain';

/**
 * Test, CI and integrate calls can take minutes on a loaded machine; Node's global fetch
 * gives up waiting for response headers after 300 s. The callers set their own deadlines.
 */
const dispatcher = new Agent({ headersTimeout: 0, bodyTimeout: 0 });
const patientFetch: FetchLike = (input, init) => undiciFetch(input, { ...(init as object), dispatcher }) as unknown as Promise<Response>;
const client = (url: string) => new WorkcellClient(url, patientFetch);
const FUSE_FLAGS = ['--device', '/dev/fuse', '--cap-add', 'SYS_ADMIN', '--security-opt', 'apparmor:unconfined'];

export interface StackOptions {
  workcells: number;
  /** host port base; gitserver = base, integrator = base+1, workcells = base+10+i */
  portBase?: number;
  /** CPU/memory caps per workcell container (docker --cpus / --memory) */
  cpus?: string;
  memory?: string;
}

export interface Stack {
  gitserverUrl: string;
  /** remote URL host as seen from inside the docker network */
  internalGitBase: string;
  integrator: WorkcellClient;
  workcells: { name: string; client: WorkcellClient }[];
}

async function docker(args: string[], allowFail = false): Promise<string> {
  try {
    const { stdout } = await exec('docker', args, { maxBuffer: 64 * 1024 * 1024 });
    return stdout.trim();
  } catch (err) {
    if (allowFail) return '';
    const e = err as { stderr?: string; message: string };
    throw new Error(`docker ${args.slice(0, 3).join(' ')} failed: ${e.stderr ?? e.message}`);
  }
}

export async function buildImage(repoRoot: string, log: (s: string) => void = console.log): Promise<void> {
  log(`building ${IMAGE} …`);
  await exec('docker', ['build', '-f', 'containers/workcell/Dockerfile', '-t', IMAGE, '.'], { cwd: repoRoot, maxBuffer: 256 * 1024 * 1024 });
}

async function running(name: string): Promise<boolean> {
  return (await docker(['inspect', '-f', '{{.State.Running}}', name], true)) === 'true';
}

async function runContainer(name: string, ports: string, args: string[], extra: string[] = []): Promise<void> {
  // Reuse a running container only if it publishes the expected host port and runs the current image.
  if (await running(name)) {
    const [hostPort] = ports.split(':');
    const published = await docker(['port', name], true);
    const image = await docker(['inspect', '-f', '{{.Image}}', name], true);
    const current = await docker(['image', 'inspect', '-f', '{{.Id}}', IMAGE], true);
    if (published.includes(`:${hostPort}`) && image === current) return;
  }
  await docker(['rm', '-f', name], true);
  await docker(['run', '-d', '--name', name, '--network', NETWORK, '--network-alias', name, '-p', ports, ...extra, IMAGE, ...args]);
}

async function waitHealthy(client: WorkcellClient, what: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      await client.health();
      return;
    } catch (err) {
      last = err;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw new Error(`${what} not healthy: ${String(last)}`);
}

/** Start (or reuse) the gitserver, integrator and N workcells on a docker network. */
export async function upStack(opts: StackOptions): Promise<Stack> {
  const base = opts.portBase ?? 18_090;
  await docker(['network', 'create', NETWORK], true);
  const limits = [...(opts.cpus ? ['--cpus', opts.cpus] : []), ...(opts.memory ? ['--memory', opts.memory] : [])];

  // Repos live on a named volume, so rebuilding the image does not lose them.
  await runContainer('gitserver', `${base}:8090`, ['serve-git', '--listen', ':8090', '--root', '/srv/git', '--public-url', 'http://gitserver:8090'], ['-v', 'livemain-git:/srv/git']);
  await runContainer('integrator', `${base + 1}:8080`, ['serve', '--listen', ':8080', '--role', 'integrator'], FUSE_FLAGS);
  const workcells: Stack['workcells'] = [];
  const starts: Promise<void>[] = [];
  for (let i = 0; i < opts.workcells; i++) {
    const name = `workcell-${i}`;
    starts.push(runContainer(name, `${base + 10 + i}:8080`, ['serve', '--listen', ':8080', '--role', 'workcell'], [...FUSE_FLAGS, ...limits]));
    workcells.push({ name, client: client(`http://127.0.0.1:${base + 10 + i}`) });
  }
  await Promise.all(starts);

  const stack: Stack = {
    gitserverUrl: `http://127.0.0.1:${base}`,
    internalGitBase: 'http://gitserver:8090',
    integrator: client(`http://127.0.0.1:${base + 1}`),
    workcells,
  };
  await waitHealthy(new WorkcellClient(stack.gitserverUrl), 'gitserver').catch(async () => {
    // gitserver may not implement /health; fall back to a repo listing probe
    const res = await fetch(`${stack.gitserverUrl}/repos/__probe__/refs/heads/main`).catch(() => null);
    if (!res) throw new Error('gitserver unreachable');
  });
  await waitHealthy(stack.integrator, 'integrator');
  await Promise.all(workcells.map((w) => waitHealthy(w.client, w.name)));
  return stack;
}

export async function downStack(): Promise<void> {
  const names = (await docker(['ps', '-a', '--filter', `network=${NETWORK}`, '--format', '{{.Names}}'], true)).split('\n').filter(Boolean);
  if (names.length > 0) await docker(['rm', '-f', ...names], true);
  await docker(['network', 'rm', NETWORK], true);
}

/** Create a fresh bare repo on the gitserver (the Artifacts `create` equivalent). */
export async function createRepo(stack: Stack, name: string): Promise<string> {
  const res = await fetch(`${stack.gitserverUrl}/repos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`create repo ${name}: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { remote: string };
  return body.remote;
}
