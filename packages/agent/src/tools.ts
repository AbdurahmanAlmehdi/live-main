import type { Task } from '@livemain/protocol';
import type { AgentSession } from './session.js';

export { AGENT_TOOLS } from '@livemain/protocol';

/** The working rules an agent starts with. */
export function agentBrief(session: Pick<AgentSession, 'strategy'>, project: string): string {
  return [
    `You are a software engineer agent working on ${project}, one of many agents working on the same codebase at the same time.`,
    'Work only through the tools. Start by reading README.md, then the files relevant to your task. Keep changes focused on your task; do not refactor unrelated code or edit other functions’ tests.',
    'Done means: your task tests pass and submit reports the change landed. If submit does not land, follow its instructions.',
    '',
    session.strategy.describe(),
  ].join('\n');
}

export function taskMessage(t: Task): string {
  return [
    `Task ${t.id}: ${t.title}`,
    '',
    t.prompt,
    '',
    `Task tests: ${t.tests.join(', ')}`,
  ].join('\n');
}
