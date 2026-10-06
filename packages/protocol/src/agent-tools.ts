/** A tool as models and MCP clients see it (JSON Schema input). */
export interface AgentToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * The tools an agent works through, for every driver: the built-in LLM loop and external agents
 * (Claude Code over `lm mcp`). Executed by AgentSession.call.
 */
export const AGENT_TOOLS: AgentToolSpec[] = [
  {
    name: 'read_file',
    description: 'Read a file from the repository. Returns numbered lines. Use offset/limit (1-based lines) for large files.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string' }, offset: { type: 'integer' }, limit: { type: 'integer' } },
      required: ['path'],
      additionalProperties: false,
    },
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a file with the given content (parent directories are created).',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string' }, content: { type: 'string' } },
      required: ['path', 'content'],
      additionalProperties: false,
    },
  },
  {
    name: 'edit_file',
    description: 'Replace an exact string in a file. old_string must match exactly once unless replace_all is true. Prefer this over write_file for small changes to existing files.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        old_string: { type: 'string' },
        new_string: { type: 'string' },
        replace_all: { type: 'boolean' },
      },
      required: ['path', 'old_string', 'new_string'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file.',
    inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false },
  },
  {
    name: 'replace_in_files',
    description: 'Regex find-and-replace across all files matching a glob (e.g. "src/**/*.ts"), like a codemod. JavaScript regex syntax; use $1..$9 in the replacement for groups. Reports which files changed.',
    inputSchema: {
      type: 'object',
      properties: { glob: { type: 'string' }, pattern: { type: 'string' }, replacement: { type: 'string' }, flags: { type: 'string', description: 'regex flags, default "g"' } },
      required: ['glob', 'pattern', 'replacement'],
      additionalProperties: false,
    },
  },
  {
    name: 'revert_file',
    description: 'Discard your changes to one file (including a deletion or a newly created file), restoring the version you started from.',
    inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false },
  },
  {
    name: 'list_dir',
    description: 'List a directory (repo-relative, "" for the root).',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string' }, recursive: { type: 'boolean' } },
      additionalProperties: false,
    },
  },
  {
    name: 'grep',
    description: 'Search file contents with a regular expression (RE2 syntax). Optional path (directory) and glob (e.g. "*.ts").',
    inputSchema: {
      type: 'object',
      properties: { pattern: { type: 'string' }, path: { type: 'string' }, glob: { type: 'string' } },
      required: ['pattern'],
      additionalProperties: false,
    },
  },
  {
    name: 'run_tests',
    description: 'Run vitest on the given test files (defaults to your task tests). Returns pass/fail and failure messages.',
    inputSchema: {
      type: 'object',
      properties: { files: { type: 'array', items: { type: 'string' } } },
      additionalProperties: false,
    },
  },
  {
    name: 'submit',
    description: 'Land your change on main once your task tests pass. Follow the instructions in the result if it does not land.',
    inputSchema: {
      type: 'object',
      properties: { message: { type: 'string', description: 'one-line summary of the change' } },
      required: ['message'],
      additionalProperties: false,
    },
  },
];
