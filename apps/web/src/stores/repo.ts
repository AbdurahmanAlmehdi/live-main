import type { AgentSummary, ApprovalView, Landing, Notice, Repo, RepoEvent, Swarm, TreeEntry } from '@livemain/protocol';
import { FINAL_AGENT_STATES } from '@livemain/protocol';
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { api } from '@/lib/api';

/**
 * The open repository: live main, landings, agents and swarms, kept current by the repo's
 * event stream. Views read from here; nothing polls.
 */
export const useRepo = defineStore('repo', () => {
  const owner = ref('');
  const name = ref('');
  const repo = ref<Repo | null>(null);
  const error = ref<string | null>(null);
  const landings = ref<Landing[]>([]);
  const newLandings = ref<Set<number>>(new Set());
  const agents = shallowRef(new Map<string, AgentSummary>());
  const swarms = shallowRef(new Map<string, Swarm>());
  const notices = ref<Notice[]>([]);
  /** approvals agents' landings wait for (newest first; pending and decided) */
  const approvals = ref<ApprovalView[]>([]);
  const tree = ref<TreeEntry[] | null>(null);
  const treeStale = ref(false);
  const live = ref(false);
  /** bumps whenever main moves, so open views can refresh what they show */
  const mainTick = ref(0);
  let close: (() => void) | null = null;

  const base = computed(() => `/${owner.value}/${name.value}`);
  const agentList = computed(() => [...agents.value.values()].sort((a, b) => b.startedAt - a.startedAt));
  const activeAgents = computed(() => agentList.value.filter((a) => !FINAL_AGENT_STATES.has(a.state)));
  const swarmList = computed(() => [...swarms.value.values()].sort((a, b) => b.createdAt - a.createdAt));
  const pendingApprovals = computed(() => approvals.value.filter((a) => a.status === 'pending'));
  const runningSwarm = computed(() => swarmList.value.find((s) => s.status === 'running' || s.status === 'paused' || s.status === 'stopping') ?? null);

  async function open(o: string, n: string) {
    if (o === owner.value && n === name.value && repo.value) return;
    close?.();
    owner.value = o;
    name.value = n;
    repo.value = null;
    error.value = null;
    landings.value = [];
    agents.value = new Map();
    swarms.value = new Map();
    notices.value = [];
    approvals.value = [];
    tree.value = null;
    try {
      const [r, ls, as, ss, aps] = await Promise.all([api.repo(o, n), api.landings(o, n), api.agents(o, n), api.swarms(o, n), api.approvals(o, n)]);
      repo.value = r;
      landings.value = ls;
      approvals.value = aps;
      agents.value = new Map(as.map((a) => [a.id, a]));
      swarms.value = new Map(ss.map((s) => [s.id, s]));
      let first = true;
      close = api.events(o, n, apply, (on) => {
        live.value = on;
        // After a reconnect, refetch what changed while the socket was down.
        if (on && !first) void resync();
        first = false;
      });
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  function apply(e: RepoEvent) {
    switch (e.type) {
      case 'main': {
        if (repo.value && (!repo.value.main || e.main.version >= repo.value.main.version)) {
          repo.value = { ...repo.value, main: e.main, activity: { ...repo.value.activity, lastLandingAt: e.landing.at, landingsToday: repo.value.activity.landingsToday + (landings.value.some((l) => l.version === e.landing.version) ? 0 : 1) } };
        }
        const exists = landings.value.some((l) => l.version === e.landing.version);
        landings.value = exists ? landings.value.map((l) => (l.version === e.landing.version ? e.landing : l)) : [e.landing, ...landings.value];
        if (!exists) newLandings.value = new Set([...newLandings.value, e.landing.version]);
        treeStale.value = true;
        mainTick.value++;
        break;
      }
      case 'agent': {
        const next = new Map(agents.value);
        next.set(e.agent.id, e.agent);
        agents.value = next;
        if (repo.value) repo.value = { ...repo.value, activity: { ...repo.value.activity, activeAgents: [...next.values()].filter((a) => !FINAL_AGENT_STATES.has(a.state)).length, approaching: [...next.values()].filter((a) => a.state === 'ready').length } };
        if (e.agent.writes.length) treeStale.value = true;
        break;
      }
      case 'swarm': {
        const next = new Map(swarms.value);
        next.set(e.swarm.id, e.swarm);
        swarms.value = next;
        break;
      }
      case 'notice':
        notices.value = [e.notice, ...notices.value].slice(0, 200);
        break;
      case 'ci':
        landings.value = landings.value.map((l) => (l.version === e.version ? { ...l, ci: { passed: e.passed, failed: e.failed } } : l));
        break;
      case 'approval':
        upsertApproval(e.approval);
        break;
    }
  }

  async function loadTree(force = false) {
    if (tree.value && !treeStale.value && !force) return;
    treeStale.value = false;
    tree.value = await api.tree(owner.value, name.value);
  }

  async function moreLandings() {
    const oldest = landings.value.at(-1)?.version;
    if (!oldest || oldest <= 1) return;
    landings.value = [...landings.value, ...(await api.landings(owner.value, name.value, oldest))];
  }

  function upsertApproval(a: ApprovalView) {
    const rest = approvals.value.filter((x) => x.id !== a.id);
    approvals.value = [a, ...rest].sort((x, y) => y.requestedAt - x.requestedAt);
  }
  function upsertSwarm(s: Swarm) {
    const next = new Map(swarms.value);
    next.set(s.id, s);
    swarms.value = next;
  }

  async function refresh() {
    repo.value = await api.repo(owner.value, name.value);
  }

  async function resync() {
    const [r, ls, as, ss, aps] = await Promise.all([api.repo(owner.value, name.value), api.landings(owner.value, name.value), api.agents(owner.value, name.value), api.swarms(owner.value, name.value), api.approvals(owner.value, name.value)]);
    repo.value = r;
    landings.value = ls;
    approvals.value = aps;
    agents.value = new Map(as.map((a) => [a.id, a]));
    swarms.value = new Map(ss.map((s) => [s.id, s]));
    treeStale.value = true;
    mainTick.value++;
  }

  return { owner, name, repo, error, landings, newLandings, agents, swarms, notices, approvals, pendingApprovals, tree, treeStale, live, mainTick, base, agentList, activeAgents, swarmList, runningSwarm, open, loadTree, moreLandings, upsertSwarm, upsertApproval, refresh, apply };
});
