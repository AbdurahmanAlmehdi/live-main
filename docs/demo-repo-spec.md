# Demo repo + task bank spec

Two deliverables:

1. `demo-repo/`: the **stubbed** spreadsheet formula engine that gets seeded as `main`.
   Agents work on it. It must contain **no** reference implementations of task work.
2. `bench/`: the task bank, reference solutions (for scripted agents and for validation),
   and the oracle test generator. Nothing in `bench/` is ever visible to agents.

## demo-repo/ layout and conventions

```
demo-repo/
  package.json          name "formula-engine", type module, devDeps: vitest 3.2.7, typescript 5.9.3 (exact pins)
  package-lock.json     committed (workcell image runs `npm ci` from it into /deps)
  tsconfig.json         strict, isolatedModules, noEmit, include src + tests
  vitest.config.ts      see "Vitest config" below
  README.md             what the engine is, how functions are added (this is what agents read)
  src/core/value.ts     Value model
  src/core/errors.ts    error constructors/predicates
  src/core/coerce.ts    toNumber / toText / toBoolean / ...
  src/core/args.ts      argument flattening helpers (ranges/arrays → scalars) with options
  src/core/range.ts     2D range/array type + helpers
  src/core/types.ts     FormulaFunction type, EvalContext
  src/core/registry.ts  name → lazy loader map (the hot spot)
  src/eval/lexer.ts, parser.ts, evaluate.ts   formula string → Value
  src/helpers/*.ts      shared helpers; some fully implemented, some stubs that throw NotImplemented (helper tasks)
  src/functions/<category>/<NAME>.ts           one file per function, created by leaf tasks (absent in stubbed repo)
  tests/functions/<NAME>.test.ts               one file per function, present from the start, failing with #NAME?
  tests/helpers/<helper>.test.ts               tests for helper tasks
  tests/core/*.test.ts                         tests for core (pass in stubbed repo)
```

### Value model (must be simple and explicit)
```ts
export type ErrorCode = '#NULL!' | '#DIV/0!' | '#VALUE!' | '#REF!' | '#NAME?' | '#NUM!' | '#N/A';
export type Value = number | string | boolean | null /* empty */ | FormulaError | RangeValue;
```
`FormulaError` is a class instance with `code`. `RangeValue` is a 2D array wrapper.

### Registry (critical, do not deviate)
`src/core/registry.ts` is a single object literal, one entry per line, each entry a **lazy
loader**, so a test run only opens the files for the function it calls:
```ts
import type { FunctionLoader } from './types';
export const registry: Record<string, FunctionLoader> = {
  // functions (one per line, keep this marker as the last line inside the object)
};
```
Entries look like `  SUM: () => import('../functions/math/SUM'),`. Each function module
`export default` a `FormulaFunction`. The stubbed repo ships with an **empty** registry
(core tests use an injected registry). Every leaf task adds exactly one line, which makes
this file a deliberate concurrent-edit hot spot. New lines are added at the end, just
before the closing `};`.

The evaluator resolves names through `registry`; unknown → `#NAME?`. Nothing may import
all function modules eagerly (that would make every test's read set the whole repo).

### Vitest config
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  cacheDir: process.env.LIVEMAIN_CACHE_DIR ?? 'node_modules/.vite',
  test: { include: ['tests/**/*.test.ts'], pool: 'forks', poolOptions: { forks: { singleFork: true } }, isolate: false, watch: false },
});
```
No `globals`, no setup files that import the world.

### Tests
- Every function test imports only `../../src/eval/evaluate` and `../../src/core/value` (and
  similar), and asserts on `await evaluate('=SUM(1,2,3)')`. Tests contain oracle values
  generated from formula.js (see bench/oracle) and are written as literal expectations
  (no formula.js at runtime). Numbers compared with `toBeCloseTo(x, 9)`.
- Each function test file has 4-12 cases, including at least one error case where meaningful.
- In the stubbed repo: `tests/core/**` pass, `tests/functions/**` and `tests/helpers/**` fail.

## bench/ layout

```
bench/
  package.json            name "@livemain/bench" (pnpm workspace member), devDeps @formulajs/formulajs
  oracle/                 generator: function spec list → test files in demo-repo/tests/functions
  tasks.json              the task bank
  solutions/<taskId>.json reference solutions
  scripts/validate.ts     applies ALL solutions in dependency order onto a temp copy of demo-repo,
                          runs the full suite, must be 100% green; also checks stubbed repo
                          state (core pass, functions/helpers fail)
```

### tasks.json
```jsonc
{ "version": 1,
  "tasks": [
    { "id": "fn-SUM",                       // stable id
      "kind": "leaf" | "helper" | "change-order" | "trap",
      "title": "Implement SUM",
      "prompt": "Implement the SUM spreadsheet function ...",  // what the agent is told (no solution hints beyond a normal ticket)
      "tests": ["tests/functions/SUM.test.ts"],  // tests that must pass for the task to be done
      "dependsOn": ["helper-args-flatten"],    // tasks that must land first (planner input)
      "category": "math",
      "expectedFiles": ["src/functions/math/SUM.ts", "src/core/registry.ts"],
      "releaseAt": 0.3,                        // change-orders only: fraction of run elapsed before release
      "contract": false,                       // true for change orders
      "breaks": ["fn-SUMIF"]                   // traps/change-orders: tasks whose solutions are affected
    } ] }
```
Target mix (~300 tasks): about 240 leaf, about 35 helper, about 12 change-order, about 12 trap.

### solutions/<taskId>.json
```jsonc
{ "taskId": "fn-SUM",
  "variants": [
    { "requires": [],                       // change-order ids that must have landed for this variant
      "ops": [
        { "op": "write", "path": "src/functions/math/SUM.ts", "content": "..." },
        { "op": "insertBefore", "path": "src/core/registry.ts", "anchor": "  // functions (one per line", "text": "  SUM: () => import('../functions/math/SUM'),\n" },
        { "op": "edit", "path": "...", "oldString": "...", "newString": "..." },
        { "op": "codemod", "glob": "src/functions/**/*.ts", "find": "<JS regex source>", "flags": "g", "replace": "..." }
      ] } ] }
```
A scripted agent picks the variant with the largest `requires` that is a subset of the landed
change orders. `insertBefore` inserts `text` before the line containing `anchor`. Registry
lines go *before* the marker comment, which itself stays last in the object (so both sides insert
at the same spot, like real concurrent appends).

### Helpers, change orders, traps
- **Helper tasks**: implement a stubbed helper in `src/helpers/` (criteria matching for
  *IF/*IFS functions, date serial math, text formatting for TEXT, statistics primitives,
  lookup matching, financial primitives, ...). Leaf tasks that need a helper list it in `dependsOn`.
- **Change orders** (contract changes, released mid-run): modify `src/core/*`, typically
  changing a signature or adding a variant, **plus a codemod that updates every existing call
  site** in `src/**`. Their effects must be **runtime-observable** (vitest strips types, so a
  type-only change is invisible). Example: `flattenArgs(args)` → `flattenArgs(args, opts)` where
  `opts` is required and read at runtime. Leaf tasks affected by a CO get a second solution variant
  with `requires: ["co-..."]`. Each CO also has tests (in `tests/core/`) that fail before it lands.
  Those tests are added by the CO solution itself (op write) so the stubbed repo stays green on core.
- **Traps**: a task whose own tests pass and whose diff merges cleanly in git, but which changes
  shared behavior that other functions rely on (e.g. a helper's treatment of empty strings or
  booleans). `breaks` lists the tasks whose tests fail if the trap lands *after* them without
  adaptation. The trap task's prompt is legitimate (it fixes a real behavior per its tests). The
  correct resolution is for the trap author to keep dependents green (e.g. add an option instead
  of changing a default), and the trap's reference solution does exactly that. Validation must
  show: the naive version (`bench/solutions/<trap>.naive.json`) breaks the listed dependents, and
  the reference version does not.
