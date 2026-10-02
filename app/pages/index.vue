<script setup lang="ts">
import { ref, watch } from 'vue';
import { api } from '~/utils/api';
import { cachedApi, clearMemberCache } from '~/utils/cache';
import { rangeWholeMonth, taipeiMonth } from '#shared/utils/date';
import type { MemberStats, SessionRow } from '#shared/types';

/**
 * 請假頁（首頁）：本月出席／已請假、接下來的場次、請假。
 *
 * - 場次：還沒開打、我還沒請假的；過了請假截止但還沒開打的照樣列出，按鈕反灰「已截止」。
 * - 本月統計查「整個本月」：出席只算已結束的場次；已請假＝已結束的請假＋還沒打的請假，
 *   剛送出的假馬上看得到。
 * - 載入失敗保留舊資料、顯示重試，不把故障誤顯示成「沒有場次」。
 */
const { me } = useMe();
const month = taipeiMonth(); // 台北月份，與統計區間一致（不用裝置時區）

const sessions = ref<SessionRow[]>([]);
const stats = ref<{ attend: number; leave: number } | null>(null);
const loadError = ref(false);
const loaded = ref(false);

const target = ref<SessionRow | null>(null); // 正在確認要請假的場次
const busy = ref(false);
const actionError = ref('');

async function load() {
  const [s, st] = await Promise.all([
    cachedApi<SessionRow[]>('/api/sessions/available'),
    cachedApi<MemberStats>(`/api/stats/mine?${new URLSearchParams(rangeWholeMonth())}`),
  ]);
  if (s.ok) sessions.value = s.data;
  if (st.ok) stats.value = { attend: st.data.attendCount, leave: st.data.leaveCount + st.data.upcomingLeaveCount };
  loadError.value = !s.ok || !st.ok;
  loaded.value = true;
}

// 首次設定填完名字後才載入（還在設定中的新帳號不必先打這些 API）
watch(
  () => me.value?.realName,
  (name) => {
    if (name) void load();
  },
  { immediate: true },
);

function openConfirm(s: SessionRow) {
  target.value = s;
  actionError.value = '';
}

async function confirmLeave() {
  if (!target.value) return;
  busy.value = true;
  actionError.value = '';
  const r = await api('/api/leaves', { method: 'POST', body: { sessionId: target.value.id } }, '請假失敗，請稍後再試');
  busy.value = false;
  // 失敗不關視窗、不誤報成功，把原因留在框裡
  if (!r.ok) {
    actionError.value = r.error;
    return;
  }
  target.value = null;
  clearMemberCache(); // 資料變了，清快取再重抓
  await load();
}
</script>

<template>
  <ProfileHeader />

  <div :style="{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }">
    <UiStatCard :label="`${month} 月出席`" :value="stats ? `${stats.attend} 場` : '— 場'" />
    <UiStatCard :label="`${month} 月已請假`" :value="stats ? `${stats.leave} 場` : '— 場'" />
  </div>

  <p :style="{ margin: '0 0 12px', fontSize: '15px', fontWeight: 500 }">接下來的場次</p>

  <LoadErrorBanner v-if="loadError" @retry="load" />

  <template v-if="sessions.length > 0">
    <SessionCard
      v-for="s in sessions"
      :key="s.id"
      :session="s"
      :badge="s.kind === 'extra' ? 'extra' : 'attend'"
    >
      <template #action>
        <!-- 過了請假截止但還沒開打：照樣顯示這場，按鈕反灰 -->
        <UiButton v-if="s.leaveClosed" disabled>已截止</UiButton>
        <UiButton v-else @click="openConfirm(s)">請假</UiButton>
      </template>
    </SessionCard>
  </template>
  <p v-else-if="loaded" :style="{ fontSize: '14px', color: 'var(--text-muted)' }">
    {{ loadError ? '目前無法載入場次' : '接下來沒有場次' }}
  </p>
  <p v-else :style="{ fontSize: '14px', color: 'var(--text-muted)' }">載入中…</p>

  <ConfirmDialog
    :open="!!target"
    title="確定要請這場的假？"
    confirm-label="確定請假"
    danger
    :busy="busy"
    :error="actionError"
    @confirm="confirmLeave"
    @cancel="target = null"
  >
    <SessionSummary v-if="target" :session="target" />
  </ConfirmDialog>
</template>
