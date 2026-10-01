<script setup lang="ts">
/** 錯誤訊息（深紅小字）。沒有訊息時不畫任何東西，呼叫端不必再包 v-if。 */
defineProps<{ message?: string | null }>();
</script>

<template>
  <p v-if="message" role="alert" :style="{ margin: '12px 0 0', fontSize: '13px', color: 'var(--text-danger)' }">
    {{ message }}
  </p>
</template>
