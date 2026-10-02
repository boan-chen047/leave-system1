<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { isSetupComplete } from '#shared/utils/setup';

/**
 * 登入閘門：決定目前該顯示什麼（取代 Next.js 版 LiffProvider 的畫面判斷）。
 *
 *   公開頁（頁面設 definePageMeta({ public: true })，如隱私權政策）→ 不需登入，直接顯示
 *   無法使用（fatal）→ 錯誤畫面（例：帳號被管理員停用、LIFF 設定錯誤）
 *   載入中 → 載入畫面
 *   開發測試登入 → 選測試帳號畫面（只在本機開發）
 *   帳號自助停用中 → 重新啟用畫面
 *   已登入 → 頁面內容＋首次設定三關（卡在哪關就跳哪關的彈窗）
 *            ＋設定完成後，若有「請假場次異動」通知就跳彈窗
 */
const route = useRoute();
const { me, loading, fatal, needsDevLogin, init, devSwitch } = useMe();
const isPublic = computed(() => route.meta.public === true);
const setupDone = computed(() => isSetupComplete(me.value));
// 開發模式且有開測試登入才顯示「切換帳號」（只開發模式但沒開測試登入時，切換後會進到用不了的畫面）
const showDevSwitch = import.meta.dev && isFlagOn(useRuntimeConfig().public.devLogin);

// 進入需登入的頁面才啟動登入流程（init 本身保證整個 app 只跑一次）；
// 從公開頁（如隱私權政策）點回首頁時也會在這裡觸發。
onMounted(() => {
  if (!isPublic.value) void init();
});
watch(isPublic, (pub) => {
  if (!pub) void init();
});
</script>

<template>
  <slot v-if="isPublic" />
  <StatusScreen v-else-if="fatal" title="無法使用" :message="fatal">
    <p :style="{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }">如果你認為這是錯誤，請聯絡管理員。</p>
  </StatusScreen>
  <StatusScreen v-else-if="loading" title="載入中…" />
  <DevLoginScreen v-else-if="needsDevLogin" />
  <DeactivatedGate v-else-if="me && !me.isActive" />
  <template v-else-if="me">
    <slot />
    <FirstSetup />
    <LeaveChangeNoticeDialog :enabled="setupDone" :on-cancel-page="route.path === '/cancel'" />
    <!-- 本機開發才有：切換測試帳號（正式建置時 import.meta.dev 為 false，這顆不會出現） -->
    <button
      v-if="showDevSwitch"
      type="button"
      :style="{
        position: 'fixed',
        top: '8px',
        right: '8px',
        zIndex: 40,
        fontSize: '12px',
        padding: '4px 10px',
        borderRadius: '20px',
        border: '0.5px solid var(--border-strong)',
        background: 'var(--surface-1)',
        color: 'var(--text-secondary)',
      }"
      @click="devSwitch"
    >
      開發：切換帳號
    </button>
  </template>
</template>
