<script setup lang="ts">
import type { Swarm } from '@livemain/protocol';
import { computed } from 'vue';
import { duration, plural, usd } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import BudgetMeter from './BudgetMeter.vue';
import CliInline from './CliInline.vue';
import LmIcon from './LmIcon.vue';
import StatusChip from './StatusChip.vue';

const props = defineProps<{ swarm: Swarm; to?: string; busy?: boolean }>();
defineEmits<{ pause: []; resume: []; stop: [] }>();
const now = useNow();

const c = computed(() => props.swarm.counts);
const live = computed(() => props.swarm.status === 'running' || props.swarm.status === 'paused' || props.swarm.status === 'stopping');
const pct = (n: number) => `${((n / Math.max(1, c.value.total)) * 100).toFixed(2)}%`;
const elapsed = computed(() => (props.swarm.finishedAt ?? now.value) - props.swarm.createdAt);
const statusText = computed(() => {
  const s = props.swarm;
  const by = s.dispatchedBy ? ` · dispatched by ${s.dispatchedBy}` : '';
  if (s.status === 'running') return `running ${duration(elapsed.value)}${by}`;
  if (s.status === 'paused') return `paused${s.reason ? `: ${s.reason}` : ''}${by}`;
  if (s.status === 'stopping') return 'stopping: agents finish their current step';
  return `${s.status} in ${duration(elapsed.value)}${s.reason && s.status === 'stopped' ? ` · ${s.reason}` : ''}${by}`;
});
const anyModel = computed(() => props.swarm.rules.some((r) => r.worker.kind === 'model'));
</script>

<template>
  <section class="lm-swarm" aria-label="Swarm progress">
    <div class="row-3">
      <span class="lm-dot" :class="{ 'lm-live': swarm.status === 'running' }" aria-hidden="true" />
      <RouterLink v-if="to" :to="to" class="title-sm">{{ swarm.name }}</RouterLink>
      <span v-else class="title-sm">{{ swarm.name }}</span>
      <span class="caption muted">{{ plural(c.total, 'task') }} · {{ plural(swarm.concurrency, 'agent') }} · {{ statusText }}</span>
      <span class="grow" />
      <template v-if="live">
        <button v-if="swarm.status === 'paused'" type="button" class="lm-btn is-secondary" :disabled="busy" @click="$emit('resume')"><LmIcon name="play" />Resume</button>
        <button v-else type="button" class="lm-btn is-secondary" :disabled="busy || swarm.status === 'stopping'" @click="$emit('pause')"><LmIcon name="pause" />Pause</button>
        <button type="button" class="lm-btn is-danger" :disabled="busy || swarm.status === 'stopping'" @click="$emit('stop')"><LmIcon name="stop" />Stop</button>
      </template>
    </div>
    <div class="lm-stack" role="img" :aria-label="`${c.landed} landed, ${c.running} running, ${c.queued} queued, ${c.gaveUp} gave up, of ${c.total}`">
      <span :style="{ width: pct(c.landed) }" data-seg="landed" /><span :style="{ width: pct(c.running) }" data-seg="running" /><span :style="{ width: pct(c.queued) }" data-seg="queued" />
    </div>
    <dl class="lm-counts">
      <div><dt><StatusChip bare state="landed" /></dt><dd :key="c.landed" class="numeric-live lm-tick">{{ c.landed }}</dd></div>
      <div><dt><StatusChip bare state="working" label="running" /></dt><dd :key="c.running" class="numeric-live lm-tick">{{ c.running }}</dd></div>
      <div><dt><StatusChip bare state="queued" /></dt><dd :key="c.queued" class="numeric-live lm-tick">{{ c.queued }}</dd></div>
      <div><dt><StatusChip bare state="guarded" /></dt><dd class="numeric-live">{{ c.guarded }}</dd></div>
      <div><dt><StatusChip bare state="gave-up" /></dt><dd class="numeric-live">{{ c.gaveUp }}</dd></div>
      <div><dt><StatusChip bare state="error" label="failed" /></dt><dd class="numeric-live">{{ c.failed }}</dd></div>
    </dl>
    <div class="row-3 wrap">
      <span class="numeric-live">{{ anyModel ? usd(swarm.cost.usd) : '$0.00' }}</span>
      <span class="caption muted">
        <template v-if="swarm.budget.maxUsd !== null">of {{ usd(swarm.budget.maxUsd) }} budget</template><template v-else>no budget cap</template>
        <template v-if="anyModel && swarm.estimateUsd !== null && live"> · est. {{ usd(swarm.estimateUsd) }} at finish</template>
        <template v-if="!anyModel"> · replay workers use no model tokens</template>
      </span>
      <span class="grow" />
      <CliInline :command="`lm swarm watch ${swarm.id} ${swarm.repoId.replace('.', '/')}`" />
    </div>
    <BudgetMeter v-if="swarm.budget.maxUsd !== null" :spent="swarm.cost.usd" :cap="swarm.budget.maxUsd" :estimate="swarm.estimateUsd" :paused="swarm.status === 'paused'" />
  </section>
</template>
