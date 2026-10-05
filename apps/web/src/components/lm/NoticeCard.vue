<script setup lang="ts">
import type { NoticeV1 } from '@livemain/protocol';
import { computed } from 'vue';
import { agentName, ago } from '@/lib/format';
import { highlightLine, langOf } from '@/lib/highlight';
import { useNow } from '@/lib/useNow';
import ChangeTag from './ChangeTag.vue';
import StatusChip from './StatusChip.vue';
import VersionPill from './VersionPill.vue';

/** What changed under the agent, the diff excerpt, and what the agent did about it. */
const props = defineProps<{ notice: NoticeV1 }>();
const now = useNow();
const lines = computed(() =>
  (props.notice.diff ?? '')
    .split('\n')
    .filter((l) => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'))
    .slice(0, 6)
    .map((l) => ({ kind: l[0] === '+' ? 'd-add' : 'd-del', sign: l[0] === '+' ? '+' : '−', html: highlightLine(l.slice(1), langOf(props.notice.path)) })),
);
const cls = computed(() => (props.notice.severity === 'interrupt' ? 'signature' : props.notice.severity === 'review' ? 'body' : 'additive'));
</script>

<template>
  <article v-if="notice.severity !== 'ignore'" class="lm-notice" :data-notice="notice.severity">
    <header>
      <StatusChip bare :state="notice.severity === 'interrupt' ? 'notice-interrupt' : 'notice-review'" />
      <VersionPill :version="notice.version" />
      <span class="body-strong">{{ notice.reason }}</span>
      <span class="grow" />
      <span class="caption muted">{{ ago(notice.at, now) }} ago</span>
    </header>
    <p class="body">
      {{ agentName(notice.agentId) }} {{ notice.kind === 'write-write' ? 'was changing' : 'read' }} <code class="mono-sm">{{ notice.path }}</code>;
      {{ notice.kind === 'write-write' ? (notice.mergeResult === 'merged' ? 'main changed it too, and the two were merged.' : 'main changed it too.') : `it changed on main in v${notice.version}.` }}
    </p>
    <div v-if="lines.length" class="lm-excerpt">
      <div class="mono-sm muted ex-path">{{ notice.path }} <ChangeTag :change="cls" /></div>
      <!-- eslint-disable-next-line vue/no-v-html -- escaped by highlightLine -->
      <div v-for="(l, i) in lines" :key="i" class="ex" :class="l.kind"><span class="sg">{{ l.sign }}</span><span v-html="l.html" /></div>
    </div>
    <div class="lm-did">
      <span class="caption-strong muted">WHAT {{ agentName(notice.agentId).toUpperCase() }} DID</span>
      <span class="body">{{ notice.outcome ?? 'Nothing yet: it will see this at its next tool call.' }}</span>
    </div>
  </article>
</template>
