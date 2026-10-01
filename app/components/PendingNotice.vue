<script setup lang="ts">
/**
 * 「這頁功能還沒接上」的提示。改寫期間（Next.js → Nuxt 分步搬移）用，
 * 讓骨架頁不放假資料、也看得出還差什麼。功能寫完的頁面就把它拿掉。
 */
defineProps<{ step: string; text: string }>();
</script>

<template>
  <div
    :style="{
      background: 'var(--surface-1)',
      border: '0.5px dashed var(--border-strong)',
      borderRadius: '12px',
      padding: '14px',
      marginBottom: '12px',
      fontSize: '14px',
      color: 'var(--text-secondary)',
      lineHeight: 1.6,
    }"
  >
    <strong :style="{ color: 'var(--text-primary)' }">尚未接上（{{ step }}）</strong><br />
    {{ text }}
  </div>
</template>
