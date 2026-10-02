<script setup lang="ts">
import { ref } from 'vue';
import { api } from '~/utils/api';

/**
 * 帳號已停用時的全站畫面（只有「自助停用」的人登得進來，管理員停用的在登入時就被擋）。
 * 進來自動跳「重新啟用」確認框；確認後下一季起回到季報（非當季）。先不要則停在本畫面。
 */
const { refresh } = useMe();
const asking = ref(true); // 進來自動跳一次
const busy = ref(false);
const error = ref('');

async function reactivate() {
  busy.value = true;
  error.value = '';
  const r = await api('/api/me/active', { method: 'PATCH', body: { active: true } });
  if (!r.ok) {
    error.value = r.error;
    busy.value = false;
    return;
  }
  await refresh(); // isActive 變 true → AuthGate 放行回 app
  busy.value = false;
}
</script>

<template>
  <StatusScreen title="你的帳號目前為停用狀態" message="停用期間不會出現在季報。重新啟用後，會從下一季起（非當季）回到季報。">
    <UiButton variant="primary" @click="asking = true">重新啟用帳號</UiButton>
  </StatusScreen>
  <ConfirmDialog
    :open="asking"
    title="重新啟用帳號？"
    confirm-label="確認啟用"
    cancel-label="先不要"
    :busy="busy"
    :error="error"
    @confirm="reactivate"
    @cancel="asking = false"
  >
    重新啟用後，你會從下一季起（非當季）出現在季報中。
  </ConfirmDialog>
</template>
