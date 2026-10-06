import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { AGENT_TOOLS, type AgentToolSpec, type ApprovalView, type Landing, type Swarm, type TaskV1, type AgentSummary, type Repo } from '@livemain/protocol';
import { Client } from './client.js';
import { agentHandle, agentLine, agentTool, approvalLine, claimTask, dispatch, landingLine, repoLine, subagentPrompt, swarmLine, taskLine } from './ops.js';

type Args = Record<string, unknown>;
interface Tool extends AgentToolSpec {
  run(c: Client, a: Args): Promise<string>;
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const REPO = { type: 'string', description: 'owner/name' };

/** Operator tools: a Claude Code session runs the swarm (and can hand seats to its subagents). */
const OPERATOR: Tool[] = [
  {
    name: 'list_repos',
    description: 'List Live Main repositories you can work on.',
    inputSchema: obj({}),
    run: async (c) => (await c.call<Repo[]>('GET', '/repos')).map(repoLine).join('\n') || 'No repositories.',
  },
  {
    name: 'list_tasks',
    description: 'List a repository’s tasks (default: open ones).',
    inputSchema: obj({ repo: REPO, status: { type: 'string', enum: ['open', 'queued', 'running', 'landed', 'failed', 'cancelled'] } }, ['repo']),
    run: async (c, a) => (await c.call<TaskV1[]>('GET', `${c.repo(str(a.repo)!)}/tasks?status=${str(a.status) ?? 'open'}`)).map(taskLine).join('\n') || 'No tasks.',
  },
  {
    name: 'create_task',
    description: 'Create a task (a unit of work an agent can take).',
    inputSchema: obj({ repo: REPO, title: { type: 'string' }, prompt: { type: 'string' }, tests: { type: 'array', items: { type: 'string' } } }, ['repo', 'title']),
    run: async (c, a) => taskLine(await c.call<TaskV1>('POST', `${c.repo(str(a.repo)!)}/tasks`, { title: a.title, prompt: a.prompt, tests: a.tests })),
  },
  {
    name: 'dispatch',
    description:
      'Start a swarm. worker "claude-code" opens one seat per concurrent task for Claude Code agents (you or your subagents claim them with claim_task); "scripted" replays reference solutions; "<provider>:<model>" runs Live Main’s own agents on your key. For claude-code, the result includes the prompt to give each subagent.',
    inputSchema: obj(
      {
        repo: REPO,
        task_ids: { type: 'array', items: { type: 'string' } },
        first: { type: 'integer', description: 'dispatch the first N open tasks (when task_ids is not given)' },
        new_tasks: { type: 'array', items: obj({ title: { type: 'string' }, prompt: { type: 'string' } }, ['title']) },
        concurrency: { type: 'integer', description: 'agents working at once (for claude-code: seats, i.e. subagents to run)' },
        worker: { type: 'string', description: 'claude-code | scripted | <provider>:<model>' },
        name: { type: 'string' },
      },
      ['repo', 'concurrency', 'worker'],
    ),
    run: async (c, a) => {
      const repo = str(a.repo)!;
      const s = await dispatch(c, repo, { taskIds: a.task_ids as string[] | undefined, first: a.first as number | undefined, newTasks: a.new_tasks as { title: string }[] | undefined, concurrency: Number(a.concurrency), worker: str(a.worker)!, name: str(a.name) });
      const lines = [`Dispatched ${swarmLine(s)}`, `Live view: ${c.host}/${repo}/swarms/${s.id}`];
      if (str(a.worker) === 'claude-code') {
        lines.push('', `Run ${s.concurrency} subagents in parallel (or claim seats yourself), each with this prompt:`, '---', subagentPrompt(repo, s), '---');
      }
      return lines.join('\n');
    },
  },
  {
    name: 'swarm_status',
    description: 'A swarm’s progress and what each of its agents is doing.',
    inputSchema: obj({ repo: REPO, swarm_id: { type: 'string' } }, ['repo', 'swarm_id']),
    run: async (c, a) => {
      const r = c.repo(str(a.repo)!);
      const s = await c.call<Swarm>('GET', `${r}/swarms/${encodeURIComponent(str(a.swarm_id)!)}`);
      const agents = await c.call<AgentSummary[]>('GET', `${r}/agents?swarm=${encodeURIComponent(s.id)}`);
      return [swarmLine(s), ...agents.map(agentLine)].join('\n');
    },
  },
  {
    name: 'stop_swarm',
    description: 'Stop a swarm: running agents stop at their next step, queued tasks reopen.',
    inputSchema: obj({ repo: REPO, swarm_id: { type: 'string' } }, ['repo', 'swarm_id']),
    run: async (c, a) => swarmLine(await c.call<Swarm>('POST', `${c.repo(str(a.repo)!)}/swarms/${encodeURIComponent(str(a.swarm_id)!)}/stop`)),
  },
  {
    name: 'list_approvals',
    description: 'Landings waiting for a person (they change protected paths), and recent decisions.',
    inputSchema: obj({ repo: REPO }, ['repo']),
    run: async (c, a) => (await c.call<ApprovalView[]>('GET', `${c.repo(str(a.repo)!)}/approvals`)).map(approvalLine).join('\n') || 'No approvals.',
  },
  {
    name: 'decide_approval',
    description: 'Approve or reject a landing that waits for a person. Only do this when the user asked you to.',
    inputSchema: obj({ repo: REPO, id: { type: 'string' }, approve: { type: 'boolean' }, note: { type: 'string' } }, ['repo', 'id', 'approve']),
    run: async (c, a) => approvalLine(await c.call<ApprovalView>('POST', `${c.repo(str(a.repo)!)}/approvals/${encodeURIComponent(str(a.id)!)}/${a.approve ? 'approve' : 'reject'}`, { note: a.note })),
  },
  {
    name: 'landings',
    description: 'Recent landings on main (newest first), with who made them and CI.',
    inputSchema: obj({ repo: REPO, limit: { type: 'integer' } }, ['repo']),
    run: async (c, a) => (await c.call<Landing[]>('GET', `${c.repo(str(a.repo)!)}/landings?limit=${Number(a.limit ?? 20)}`)).map(landingLine).join('\n'),
  },
];

const AGENT = { type: 'string', description: 'your agent handle, from claim_task' };

/** Agent tools: claim a seat, then work the task in its Live Main overlay. */
const AGENT_SIDE: Tool[] = [
  {
    name: 'claim_task',
    description: 'Claim the next task waiting for a Claude Code agent. Returns your agent handle, the task and the working rules. Waits up to wait_seconds for a seat to open.',
    inputSchema: obj({ repo: REPO, swarm_id: { type: 'string' }, wait_seconds: { type: 'integer' } }, ['repo']),
    run: async (c, a) => {
      const repo = str(a.repo)!;
      const t = await claimTask(c, repo, str(a.swarm_id), Number(a.wait_seconds ?? 60));
      if (t === 'done') return 'Nothing left: the swarm has no queued or running tasks. You are done.';
      if (t === 'busy') return 'No task is free right now: other agents hold the remaining ones (more may open when they land). Call claim_task again, or stop if you are done.';
      return [
        `Agent handle: ${agentHandle(repo, t.agentId)}  (pass it as "agent" to every tool)`,
        '',
        `Task ${t.task.id}: ${t.task.title}`,
        '',
        t.task.prompt,
        '',
        `Task tests: ${t.task.tests.join(', ')}`,
        '',
        '--- Working rules ---',
        t.brief,
      ].join('\n');
    },
  },
  ...AGENT_TOOLS.map(
    (t): Tool => ({
      name: t.name,
      description: `Live Main agent tool: ${t.description}`,
      inputSchema: { ...t.inputSchema, properties: { agent: AGENT, ...(t.inputSchema.properties as object) }, required: ['agent', ...(((t.inputSchema.required as string[] | undefined) ?? []) as string[])] },
      run: async (c, a) => {
        const { agent, ...input } = a;
        const out = await agentTool(c, String(agent), t.name, input);
        return out.landed ? `${out.text}\n\nLanded. Claim your next task with claim_task.` : out.text;
      },
    }),
  ),
  {
    name: 'give_up',
    description: 'Stop working on your task (it goes back to the queue). Say why.',
    inputSchema: obj({ agent: AGENT, reason: { type: 'string' } }, ['agent', 'reason']),
    run: async (c, a) => (await agentTool(c, String(a.agent), 'give_up', { reason: a.reason })).text,
  },
];

/** `lm mcp`: the Live Main MCP server on stdio (add it to Claude Code with `claude mcp add livemain -- lm mcp`). */
export async function serveMcp(host?: string): Promise<void> {
  const client = Client.fromConfig(host);
  const tools = [...OPERATOR, ...AGENT_SIDE];
  const server = new Server(
    { name: 'livemain', version: '0.1.0' },
    {
      capabilities: { tools: {} },
      instructions: `Live Main (${client.host}): version control for agent swarms. As an operator: list_repos, list_tasks, dispatch (worker "claude-code" opens seats for Claude Code agents), swarm_status. As an agent: claim_task, then work only through the agent tools with your handle, run_tests, submit.`,
    },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = tools.find((t) => t.name === req.params.name);
    if (!tool) return { content: [{ type: 'text', text: `No tool ${req.params.name}.` }], isError: true };
    try {
      const text = await tool.run(client, (req.params.arguments ?? {}) as Args);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      return { content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
  });
  await server.connect(new StdioServerTransport());
}
