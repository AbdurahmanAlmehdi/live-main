import { execFileSync } from 'node:child_process';
import type { AgentDetail, AgentSummary, ApprovalView, Landing, LandingDetail, Repo, Swarm, TaskV1 } from '@livemain/protocol';
import { gitCredential, login, logout, setupGit, status } from './auth.js';
import { CliError, Client } from './client.js';
import { serveMcp } from './mcp.js';
import { agentLine, approvalLine, dispatch, landingLine, repoLine, resolveRepo, subagentPrompt, swarmLine, taskLine } from './ops.js';

const HELP = `lm: the Live Main CLI

  lm auth login --host <url>     sign in (device code in the browser; --no-browser to only print the link)
  lm auth status | logout | setup-git
  lm repo list
  lm clone <owner/repo> [dir]
  lm task list [repo] [--status open]
  lm task create [repo] <title> [--prompt <text>]
  lm swarm dispatch [repo] (--tasks a,b | --first N) [--concurrency N] [--worker claude-code|scripted|<provider>:<model>]
  lm swarm list [repo] | watch <id> [repo] | stop <id> [repo]
  lm main log [repo] | show <version> [repo]
  lm agent list [repo] | view <id> [repo]
  lm approvals [repo] | approve <id> [repo] [--note <text>] | reject <id> [repo] [--note <text>]
  lm mcp                         MCP server for Claude Code: claude mcp add livemain -- lm mcp

[repo] is owner/name, or the repository of the clone you are in. --host overrides the default host.
`;

/** `a b --k v --flag` → positionals and flags. */
function parse(argv: string[]): { pos: string[]; flags: Record<string, string | true> } {
  const pos: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) pos.push(a);
    else if (argv[i + 1] !== undefined && !argv[i + 1]!.startsWith('--')) flags[a.slice(2)] = argv[++i]!;
    else flags[a.slice(2)] = true;
  }
  return { pos, flags };
}

const out = (s: string): void => void process.stdout.write(`${s}\n`);
const flag = (f: Record<string, string | true>, k: string) => (typeof f[k] === 'string' ? (f[k] as string) : undefined);

async function main(argv: string[]): Promise<void> {
  const { pos, flags } = parse(argv);
  const [group, cmd, ...rest] = pos;
  const host = flag(flags, 'host');
  const client = () => Client.fromConfig(host);
  /** the optional [repo] argument at index i of `rest` */
  const repoAt = (i: number) => resolveRepo(rest[i]);

  switch (group) {
    case undefined:
    case 'help':
      return out(HELP);
    case 'auth':
      if (cmd === 'login') return login(host, out, !flags['no-browser']);
      if (cmd === 'status') return status(out);
      if (cmd === 'logout') return logout(host, out);
      if (cmd === 'setup-git') return setupGit(host, out);
      if (cmd === 'git-credential') return gitCredential(rest[0]);
      break;
    case 'mcp':
      return serveMcp(host);
    case 'repo':
      if (cmd === 'list') return out((await client().call<Repo[]>('GET', '/repos')).map(repoLine).join('\n') || 'No repositories.');
      break;
    case 'clone': {
      const c = client();
      const repo = resolveRepo(cmd);
      execFileSync('git', ['-c', `credential.${c.host}.helper=!lm auth git-credential`, 'clone', `${c.host}/git/${repo}.git`, ...(rest[0] ? [rest[0]] : [])], { stdio: 'inherit' });
      return;
    }
    case 'task': {
      const c = client();
      if (cmd === 'list') {
        const repo = repoAt(0);
        return out((await c.call<TaskV1[]>('GET', `${c.repo(repo)}/tasks?status=${flag(flags, 'status') ?? 'open'}`)).map(taskLine).join('\n') || 'No tasks.');
      }
      if (cmd === 'create') {
        const [repo, title] = rest.length > 1 ? [resolveRepo(rest[0]), rest[1]] : [resolveRepo(undefined), rest[0]];
        if (!title) throw new CliError('Give the task a title.');
        return out(taskLine(await c.call<TaskV1>('POST', `${c.repo(repo)}/tasks`, { title, prompt: flag(flags, 'prompt') })));
      }
      break;
    }
    case 'swarm': {
      const c = client();
      if (cmd === 'dispatch') {
        const repo = repoAt(0);
        const worker = flag(flags, 'worker') ?? 'claude-code';
        const s = await dispatch(c, repo, { taskIds: flag(flags, 'tasks')?.split(','), first: Number(flag(flags, 'first') ?? 0) || undefined, concurrency: Number(flag(flags, 'concurrency') ?? 4), worker });
        out(`Dispatched ${swarmLine(s)}`);
        out(`Watch: lm swarm watch ${s.id} ${repo}   ·   ${c.host}/${repo}/swarms/${s.id}`);
        if (worker === 'claude-code') out(`\nSeats wait for Claude Code agents. In Claude Code (with \`lm mcp\` added), give each agent:\n\n${subagentPrompt(repo, s)}`);
        return;
      }
      if (cmd === 'list') {
        const repo = repoAt(0);
        return out((await c.call<Swarm[]>('GET', `${c.repo(repo)}/swarms`)).map(swarmLine).join('\n') || 'No swarms.');
      }
      if (cmd === 'watch' || cmd === 'stop') {
        const id = rest[0];
        if (!id) throw new CliError(`lm swarm ${cmd} <swarm-id> [repo]`);
        const repo = repoAt(1);
        if (cmd === 'stop') return out(swarmLine(await c.call<Swarm>('POST', `${c.repo(repo)}/swarms/${encodeURIComponent(id)}/stop`)));
        for (;;) {
          const s = await c.call<Swarm>('GET', `${c.repo(repo)}/swarms/${encodeURIComponent(id)}`);
          const agents = await c.call<AgentSummary[]>('GET', `${c.repo(repo)}/agents?swarm=${encodeURIComponent(id)}&active=1`);
          out(`\n${new Date().toLocaleTimeString()}  ${swarmLine(s)}`);
          for (const a of agents) out(`  ${agentLine(a)}`);
          if (s.status === 'finished' || s.status === 'stopped') return;
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      break;
    }
    case 'main': {
      const c = client();
      if (cmd === 'log') {
        const repo = repoAt(0);
        return out((await c.call<Landing[]>('GET', `${c.repo(repo)}/landings?limit=${flag(flags, 'limit') ?? 30}`)).map(landingLine).join('\n'));
      }
      if (cmd === 'show') {
        const v = rest[0];
        if (!v) throw new CliError('lm main show <version> [repo]');
        const repo = repoAt(1);
        const l = await c.call<LandingDetail>('GET', `${c.repo(repo)}/landings/${encodeURIComponent(v)}`);
        out(landingLine(l));
        for (const p of l.patches) out(`  ${p.status.padEnd(8)} ${p.path}  +${p.added} −${p.removed}  (${p.class})`);
        if (l.noticed.length) out(`  notified: ${[...new Set(l.noticed.map((n) => n.agentId))].join(', ')}`);
        return;
      }
      break;
    }
    case 'agent': {
      const c = client();
      if (cmd === 'list') {
        const repo = repoAt(0);
        return out((await c.call<AgentSummary[]>('GET', `${c.repo(repo)}/agents?active=${flags.all ? 0 : 1}`)).map(agentLine).join('\n') || 'No agents working.');
      }
      if (cmd === 'view') {
        const id = rest[0];
        if (!id) throw new CliError('lm agent view <agent-id> [repo]');
        const repo = repoAt(1);
        const a = await c.call<AgentDetail>('GET', `${c.repo(repo)}/agents/${encodeURIComponent(id)}`);
        out(agentLine(a));
        for (const s of a.steps.slice(-15)) out(`  ${JSON.stringify(s).slice(0, 160)}`);
        return;
      }
      break;
    }
    case 'approvals':
    case 'approve':
    case 'reject': {
      const c = client();
      if (group === 'approvals') {
        const repo = resolveRepo(cmd);
        return out((await c.call<ApprovalView[]>('GET', `${c.repo(repo)}/approvals`)).map(approvalLine).join('\n') || 'No approvals.');
      }
      if (!cmd) throw new CliError(`lm ${group} <approval-id> [repo] [--note <text>]`);
      const repo = repoAt(0);
      return out(approvalLine(await c.call<ApprovalView>('POST', `${c.repo(repo)}/approvals/${encodeURIComponent(cmd)}/${group}`, { note: flag(flags, 'note') })));
    }
  }
  throw new CliError(`Unknown command: lm ${[group, cmd].filter(Boolean).join(' ')}\n\n${HELP}`);
}

main(process.argv.slice(2)).catch((err: unknown) => {
  process.stderr.write(`lm: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
