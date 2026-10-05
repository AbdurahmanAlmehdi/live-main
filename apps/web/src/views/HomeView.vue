<script setup lang="ts">
import CliInline from '@/components/lm/CliInline.vue';
import LmIcon from '@/components/lm/LmIcon.vue';
import StateBox from '@/components/lm/StateBox.vue';
import { ago, plural } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { useSession } from '@/stores/session';

const session = useSession();
const now = useNow();
</script>

<template>
  <main class="lm-page is-narrow">
    <div class="lm-page-head">
      <h1 class="title-lg">Repositories</h1>
      <span class="grow" />
      <CliInline command="lm repo list" />
      <RouterLink to="/new" class="lm-btn is-primary"><LmIcon name="plus" />New repository</RouterLink>
    </div>
    <StateBox v-if="session.repos === null" kind="loading" title="Loading repositories…" />
    <StateBox v-else-if="session.repos.length === 0" title="No repositories yet" icon="repo">
      Create one, import one by URL, or start from the demo formula engine to watch a swarm land 300 tasks on one live main.
      <template #actions><RouterLink to="/new" class="lm-btn is-primary">Get started</RouterLink></template>
    </StateBox>
    <ul v-else class="lm-list">
      <li v-for="r in session.repos" :key="r.id">
        <LmIcon name="repo" />
        <span class="stack-2" style="gap: 2px; min-width: 0">
          <RouterLink :to="`/${r.owner}/${r.name}`" class="body-strong">{{ r.fullName }}</RouterLink>
          <span class="caption muted">{{ r.description || (r.source.kind === 'imported' ? `imported from ${r.source.url}` : 'hosted on Live Main') }}</span>
        </span>
        <span class="grow" />
        <span class="lm-livemini"><span class="lm-dot" :class="{ 'lm-live': r.activity.activeAgents > 0 }" aria-hidden="true" /><span class="mono-md">main v{{ r.main?.version ?? '–' }}</span></span>
        <span class="caption muted">{{ plural(r.activity.activeAgents, 'agent') }} working · {{ r.activity.landingsToday }} landings today<template v-if="r.activity.lastLandingAt"> · last {{ ago(r.activity.lastLandingAt, now) }} ago</template></span>
      </li>
    </ul>
  </main>
</template>
