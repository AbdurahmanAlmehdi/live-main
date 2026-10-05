import { onScopeDispose, ref } from 'vue';

const now = ref(Date.now());
let users = 0;
let timer: ReturnType<typeof setInterval> | null = null;

/** A shared clock for relative times ("2 min ago"), ticking every 10 s while anything uses it. */
export function useNow() {
  users++;
  if (!timer) timer = setInterval(() => (now.value = Date.now()), 10_000);
  onScopeDispose(() => {
    if (--users === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  });
  return now;
}
