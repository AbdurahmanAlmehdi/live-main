/** Types for bench/tasks.json and bench/solutions/<taskId>.json (see docs/demo-repo-spec.md). */

export type TaskKind = 'leaf' | 'helper' | 'change-order' | 'trap';

export interface Task {
  id: string;
  kind: TaskKind;
  title: string;
  prompt: string;
  tests: string[];
  dependsOn: string[];
  category: string;
  expectedFiles: string[];
  /** change-orders only: fraction of the run elapsed before the task is released. */
  releaseAt?: number;
  contract: boolean;
  /** traps / change-orders: tasks whose solutions are affected. */
  breaks?: string[];
}

export interface TaskBank {
  version: 1;
  tasks: Task[];
}

export type Op =
  | { op: 'write'; path: string; content: string }
  | { op: 'insertBefore'; path: string; anchor: string; text: string }
  | { op: 'edit'; path: string; oldString: string; newString: string }
  | { op: 'codemod'; glob: string; find: string; flags: string; replace: string };

export interface Variant {
  /** change-order ids that must have landed for this variant. */
  requires: string[];
  ops: Op[];
}

export interface Solution {
  taskId: string;
  variants: Variant[];
}

/** The registry marker every registration is inserted before. */
export const REGISTRY_PATH = 'src/core/registry.ts';
export const REGISTRY_ANCHOR = '  // functions (one per line';

/** A scripted agent picks the variant with the largest `requires` that is a subset of the landed change orders. */
export function chooseVariant(solution: Solution, landed: ReadonlySet<string>): Variant {
  let best: Variant | undefined;
  for (const v of solution.variants) {
    if (!v.requires.every((r) => landed.has(r))) continue;
    if (!best || v.requires.length > best.requires.length) best = v;
  }
  if (!best) throw new Error(`${solution.taskId}: no variant applicable with landed=[${[...landed].join(',')}]`);
  return best;
}
