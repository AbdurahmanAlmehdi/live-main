<script setup lang="ts">
import type { ApprovalView, FilePatch } from '@livemain/protocol';
import { computed, reactive, watch } from 'vue';
import DiffView from '@/components/lm/DiffView.vue';
import LmIcon from '@/components/lm/LmIcon.vue';
import StateBox from '@/components/lm/StateBox.vue';
import StatusChip from '@/components/lm/StatusChip.vue';
import { api } from '@/lib/api';
import { agentName, ago } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { useRepo } from '@/stores/repo';
import { useToasts } from '@/stores/toasts';

/** Landings that touch protected paths wait here for a person; the agent lands on approval. */
const repo = useRepo();
const toasts = useToasts();
const now = useNow();
const decided = computed(() => repo.approvals.filter((a) => a.status !== 'pending').slice(0, 30));
const notes = reactive<Record<string, string>>({});
const busy = reactive<Record<string, boolean>>({});
/** The protected files' diffs, from the waiting agent's overlay. */
const diffs = reactive<Record<string, FilePatch[] | null>>({});

watch(
  () => repo.pendingApprovals.map((a) => a.id).join(),
  () => {
    for (const a of repo.pendingApprovals) {
      if (a.id in diffs) continue;
      diffs[a.id] = null;
      api
        .agent(repo.owner, repo.name, a.agentId)
        .then((d) => (diffs[a.id] = d.patches.filter((p) => a.paths.includes(p.path))))
        .catch(() => (diffs[a.id] = []));
    }
  },
  { immediate: true },
);

async function decide(a: ApprovalView, approve: boolean) {
  busy[a.id] = true;
  const res = await toasts.guard(() => api.decide(repo.owner, repo.name, a.id, approve, notes[a.id]?.trim() || undefined), approve ? `Approved: ${a.taskTitle} will land.` : `Rejected: ${a.taskTitle} will not land.`);
  busy[a.id] = false;
  if (res) repo.upsertApproval(res);
}
</script>

<template>
  <main class="lm-page">
    <div class="stack-2">
      <h2 class="title">Approvals</h2>
      <p class="body muted">
        Agents’ changes to protected paths wait here for a person before landing. Protect paths in <RouterLink :to="`${repo.base}/settings`">Settings</RouterLink>; pushes by people are not held.
      </p>
    </div>

    <StateBox v-if="repo.pendingApprovals.length === 0" kind="empty" title="Nothing waiting for approval" />
    <section v-for="a in repo.pendingApprovals" :key="a.id" class="lm-card">
      <div class="row-3">
        <StatusChip state="ready" label="waiting for you" />
        <span class="body-strong">{{ a.taskTitle }}</span>
        <RouterLink class="caption" :to="`${repo.base}/agents/${encodeURIComponent(a.agentId)}`">{{ agentName(a.agentId) }}</RouterLink>
        <span class="grow" />
        <span class="caption muted">requested {{ ago(a.requestedAt, now) }} ago</span>
      </div>
      <span class="caption muted">Protected: <span v-for="p in a.paths" :key="p" class="mono-sm">{{ p }} </span></span>
      <StateBox v-if="diffs[a.id] === null" kind="loading" title="Loading the change…" :rows="2" />
      <div v-else-if="diffs[a.id]?.length" class="stack-3"><DiffView v-for="p in diffs[a.id]!" :key="p.path" :patch="p" layout="unified" /></div>
      <span class="row-2">
        <input v-model="notes[a.id]" class="lm-input grow" maxlength="500" placeholder="Note for the agent (optional)" :aria-label="`Note for ${a.taskTitle}`" />
        <button type="button" class="lm-btn is-ghost" :disabled="busy[a.id]" @click="decide(a, false)">Reject</button>
        <button type="button" class="lm-btn is-primary" :disabled="busy[a.id]" @click="decide(a, true)"><LmIcon name="check" />Approve</button>
      </span>
    </section>

    <template v-if="decided.length">
      <h3 class="body-strong">Decided</h3>
      <ul class="lm-list">
        <li v-for="a in decided" :key="a.id">
          <StatusChip bare :state="a.status === 'approved' ? 'landed' : a.status === 'withdrawn' ? 'stopped' : 'error'" :label="a.status" />
          <span class="body">{{ a.taskTitle }}</span>
          <span class="mono-sm muted">{{ a.paths.join(', ') }}</span>
          <span class="grow" />
          <span class="caption muted">{{ a.decidedBy }} · {{ ago(a.decidedAt, now) }} ago{{ a.note ? ` · “${a.note}”` : '' }}</span>
        </li>
      </ul>
    </template>
  </main>
</template>
