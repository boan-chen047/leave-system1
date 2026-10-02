<script setup lang="ts">
// 銷假頁。第 1 步只有版面骨架，功能在第 4 步接上。
import { taipeiMonth } from '#shared/utils/date';

const month = taipeiMonth();
</script>

<template>
  <ProfileHeader />

  <div :style="{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }">
    <UiStatCard :label="`${month} 月出席`" value="— 場" />
    <UiStatCard :label="`${month} 月已請假`" value="— 場" />
  </div>

  <p :style="{ margin: '0 0 12px', fontSize: '15px', fontWeight: 500 }">已請假的場次</p>
  <PendingNotice step="第 4 步" text="已請假場次列表與銷假功能。" />
</template>
