<script setup lang="ts">
// 請假頁（首頁）。登入與首次設定已接上（第 2 步，由 AuthGate 處理）；場次與請假在第 3 步接上。
import { taipeiMonth } from '~/utils/date';

// 用台北時間的月份，不用裝置時區（原專案的規則，見 utils/date.ts 開頭說明）
const month = taipeiMonth();
</script>

<template>
  <ProfileHeader />

  <div :style="{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }">
    <UiStatCard :label="`${month} 月出席`" value="— 場" />
    <UiStatCard :label="`${month} 月已請假`" value="— 場" />
  </div>

  <p :style="{ margin: '0 0 12px', fontSize: '15px', fontWeight: 500 }">接下來的場次</p>
  <PendingNotice step="第 3 步" text="場次列表與請假功能。" />
</template>
