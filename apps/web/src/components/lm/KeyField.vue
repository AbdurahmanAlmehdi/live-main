<script setup lang="ts">
import { PROVIDERS, type KeyInfo, type ProviderId } from '@livemain/protocol';
import { computed, ref } from 'vue';
import { api } from '@/lib/api';
import { ago } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { useSession } from '@/stores/session';
import { useToasts } from '@/stores/toasts';
import LmIcon from './LmIcon.vue';
import StatusChip from './StatusChip.vue';

/** Keys are write-only: after saving, a key is masked and never shown again. */
const props = defineProps<{ provider: ProviderId; info?: KeyInfo }>();
const session = useSession();
const toasts = useToasts();
const now = useNow();
const label = computed(() => PROVIDERS[props.provider].label);
const needsUrl = computed(() => props.provider === 'openai-compatible');
const replacing = ref(false);
const key = ref('');
const baseUrl = ref(props.info?.baseUrl ?? '');
const busy = ref(false);

const test = computed(() => props.info?.test ?? null);

async function save() {
  busy.value = true;
  const saved = await toasts.guard(() => api.setKey({ provider: props.provider, key: key.value, ...(baseUrl.value ? { baseUrl: baseUrl.value } : {}) }));
  busy.value = false;
  if (!saved) return;
  session.upsertKey(saved);
  key.value = '';
  replacing.value = false;
  toasts.push(saved.test?.ok ? `${label.value} key saved and tested: ${saved.test.message}.` : `${label.value} key saved, but the test failed: ${saved.test?.message ?? 'unknown error'}`, saved.test?.ok ? 'info' : 'error');
}
async function retest() {
  busy.value = true;
  const k = await toasts.guard(() => api.testKey(props.provider));
  busy.value = false;
  if (k) session.upsertKey(k);
}
async function remove() {
  await toasts.guard(() => session.removeKey(props.provider), `${label.value} key removed.`);
}
</script>

<template>
  <div class="lm-key">
    <template v-if="info && !replacing">
      <div class="row-3">
        <span class="body-strong">{{ label }}</span>
        <StatusChip v-if="!test" bare state="queued" label="not tested" />
        <StatusChip v-else-if="test.ok" bare state="landed" :label="`tested · ${ago(test.at, now)} ago`" />
        <StatusChip v-else bare state="error" label="test failed" />
        <span class="grow" />
        <span class="caption muted">{{ test?.ok ? test.message : info.baseUrl ?? '' }}</span>
      </div>
      <div class="row-2">
        <div class="lm-input is-locked" :aria-label="`${label} key, saved, hidden`">
          <LmIcon name="eye-off" /><span class="mono-sm">•••• •••• •••• {{ info.last4 }}</span><span class="caption muted">saved · can’t be shown again</span>
        </div>
        <button type="button" class="lm-btn is-secondary" :disabled="busy" @click="retest"><LmIcon name="retry" />Test</button>
        <button type="button" class="lm-btn is-secondary" @click="replacing = true">Replace</button>
        <button type="button" class="lm-btn is-ghost" @click="remove">Remove</button>
      </div>
      <p v-if="test && !test.ok" class="lm-error-text">{{ test.message }}</p>
    </template>
    <form v-else class="lm-field" @submit.prevent="save">
      <span class="body-strong">{{ label }}</span>
      <span class="caption muted">{{ replacing ? 'Paste the new key; the old one is replaced.' : 'Not added. Paste a key; it is stored encrypted and never shown again.' }}</span>
      <input v-if="needsUrl" v-model="baseUrl" class="lm-input" type="url" required placeholder="Base URL, e.g. http://localhost:11434/v1" aria-label="Base URL" />
      <span class="row-2">
        <input v-model="key" class="lm-input" type="password" autocomplete="off" spellcheck="false" :placeholder="provider === 'anthropic' ? 'sk-ant-…' : 'sk-…'" :aria-label="`${label} API key`" />
        <button v-if="replacing" type="button" class="lm-btn is-ghost" @click="replacing = false">Cancel</button>
        <button type="submit" class="lm-btn is-primary" :disabled="busy || key.trim().length < 8 || (needsUrl && !baseUrl)">{{ busy ? 'Saving…' : 'Save key' }}</button>
      </span>
    </form>
  </div>
</template>
