<script setup lang="ts">
defineProps<{ label: string; value: string }>();
</script>

<template>
  <div :style="{ background: 'var(--surface-1)', borderRadius: '12px', padding: '14px' }">
    <p :style="{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }">{{ label }}</p>
    <!-- 統計數字一律用主文字色。顏色只標狀態，不標數值。 -->
    <p :style="{ margin: '4px 0 0', fontSize: '22px', fontWeight: 500 }">{{ value }}</p>
  </div>
</template>
