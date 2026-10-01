<script setup lang="ts">
import { ref } from 'vue';
import type { AppRole } from '#shared/types';

/**
 * 本機開發用的測試登入畫面（取代 LINE 登入）。只有 pnpm dev 且 NUXT_PUBLIC_DEV_LOGIN=1 才會出現；
 * 正式建置時 AuthGate 不會走到這裡，後端 /api/auth/dev-login 也會回 404。
 */
const { devLogin } = useMe();
const busy = ref<AppRole | null>(null);
const error = ref('');

const ROLES: { role: AppRole; label: string }[] = [
  { role: 'member', label: '一般成員' },
  { role: 'admin2', label: '二級管理員' },
  { role: 'admin1', label: '一級管理員' },
];

async function login(role: AppRole) {
  busy.value = role;
  error.value = (await devLogin(role)) ?? '';
  busy.value = null;
}
</script>

<template>
  <StatusScreen title="開發用測試登入" message="本機無法使用 LINE 登入（LIFF 只接受 https）。選一個測試帳號登入：">
    <UiButton
      v-for="r in ROLES"
      :key="r.role"
      :variant="r.role === 'member' ? 'primary' : 'secondary'"
      :disabled="busy !== null"
      :style="{ marginBottom: '10px' }"
      @click="login(r.role)"
    >
      {{ busy === r.role ? '登入中…' : r.label }}
    </UiButton>
    <UiErrorText :message="error" />
  </StatusScreen>
</template>
