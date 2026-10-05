<script setup lang="ts">
import { CLASS_RANK, type ChangeClass, type Landing } from '@livemain/protocol';
import { computed } from 'vue';
import type { IconName } from '@/lib/icons';
import { agentName, ago, plural, workerText } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import ChangeTag from './ChangeTag.vue';
import LmIcon from './LmIcon.vue';
import VersionPill from './VersionPill.vue';

const props = defineProps<{ landing: Landing; to: string; isNew?: boolean }>();
const now = useNow();

const kind = computed<{ icon: IconName; key: string; label: string }>(() => {
  const b = props.landing.by;
  if (props.landing.changeOrder) return { icon: 'landing-change-order', key: 'landing-change-order', label: 'change order' };
  if (b.kind === 'human') return { icon: 'landing-push', key: 'landing-push', label: `push from ${b.via === 'github' ? 'GitHub' : 'git'} · ${b.name}` };
  if (b.kind === 'seed') return { icon: 'repo', key: 'landing-seed', label: 'repository created' };
  return { icon: 'landing-agent', key: 'landing-agent', label: 'agent landing' };
});

const byline = computed(() => {
  const b = props.landing.by;
  if (b.kind !== 'agent') return kind.value.label;
  return [kind.value.label, agentName(b.agentId), workerText(b.worker)].filter(Boolean).join(' · ');
});

const top = computed<ChangeClass>(() => props.landing.files.reduce<ChangeClass>((m, f) => (CLASS_RANK[f.class] > CLASS_RANK[m] ? f.class : m), 'none'));

const meta = computed(() => {
  const l = props.landing;
  const parts = [l.files.length === 1 ? l.files[0]!.path.split('/').pop()! : plural(l.files.length, 'file')];
  if (l.merged > 0) parts.push(`merged automatically (${plural(l.merged, 'file')})`);
  if (l.by.kind === 'agent') parts.push(l.impactTests.length > 0 ? `${plural(l.impactTests.length, 'impact test')} passed` : 'no impact tests needed');
  if (l.ci) parts.push(l.ci.failed === 0 ? `CI ${l.ci.passed} passing` : `CI ${l.ci.failed} failing`);
  return parts.join(' · ');
});
</script>

<template>
  <li class="lm-tl" :class="{ 'is-new': isNew }">
    <span class="tl-ic" :data-kind="kind.key"><LmIcon :name="kind.icon" /></span>
    <VersionPill :version="landing.version" />
    <span class="tl-main"><RouterLink :to="to" class="tl-title">{{ landing.title }}</RouterLink><span class="caption muted">{{ byline }}</span></span>
    <span class="tl-tags"><ChangeTag :change="top" /></span>
    <span class="caption muted tl-meta">{{ meta }}</span>
    <span class="caption muted tl-time">{{ ago(landing.at, now) }}</span>
  </li>
</template>
