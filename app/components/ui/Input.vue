<script setup lang="ts">
/**
 * 共用輸入框（48px、白底、圓角 12px）。Next.js 版每個對話框各寫一份同樣的 inputStyle。
 * 用法：<UiInput v-model="name" placeholder="…" aria-label="…" />
 * placeholder、aria-label、list、inputmode 等屬性會直接透傳到 <input>。
 */
const model = defineModel<string>({ default: '' });
</script>

<template>
  <input
    v-model="model"
    type="text"
    :style="{
      width: '100%',
      height: '48px',
      fontSize: '16px',
      borderRadius: '12px',
      border: '0.5px solid var(--border)',
      padding: '0 12px',
      boxSizing: 'border-box',
      background: 'var(--surface-1)',
      color: 'var(--text-primary)',
    }"
  />
</template>
