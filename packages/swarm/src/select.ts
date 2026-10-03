import type { Task, TaskId, TaskKind } from '@livemain/protocol';

/**
 * Pick a dependency-closed subset of about `n` tasks that keeps the bank's mix of kinds
 * and keeps contention interesting: leaves affected by the chosen change orders and traps
 * are preferred, so every chosen contract change actually ripples.
 */
export function selectTasks(bank: Task[], n: number): Task[] {
  if (n >= bank.length) return bank;
  const byId = new Map(bank.map((t) => [t.id, t]));
  const share = (k: TaskKind) => bank.filter((t) => t.kind === k).length / bank.length;
  const quota = (k: TaskKind) => Math.max(k === 'leaf' ? 1 : 0, Math.round(n * share(k)));
  const chosen = new Set<TaskId>();

  const add = (id: TaskId) => {
    if (chosen.has(id)) return;
    const t = byId.get(id);
    if (!t) return;
    chosen.add(id);
    for (const d of t.dependsOn) add(d);
  };
  const of = (k: TaskKind) => bank.filter((t) => t.kind === k);

  const contracts = [...of('change-order').slice(0, quota('change-order')), ...of('trap').slice(0, quota('trap'))];
  for (const t of contracts) add(t.id);
  const affected = new Set(contracts.flatMap((t) => t.breaks ?? []));

  const leaves = of('leaf');
  const preferred = [...leaves.filter((t) => affected.has(t.id)), ...leaves.filter((t) => !affected.has(t.id))];
  let leafCount = 0;
  for (const t of preferred) {
    if (leafCount >= quota('leaf')) break;
    add(t.id);
    leafCount++;
  }
  for (const t of of('helper')) {
    if (of('helper').filter((h) => chosen.has(h.id)).length >= quota('helper')) break;
    add(t.id);
  }
  return bank.filter((t) => chosen.has(t.id));
}
