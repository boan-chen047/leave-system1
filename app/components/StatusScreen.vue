<script setup lang="ts">
/** 置中的狀態畫面（載入中、無法使用、帳號停用、測試登入），內容放 default 插槽。 */
defineProps<{ title: string; message?: string }>();
</script>

<template>
  <main
    :style="{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      padding: '40px 24px',
      textAlign: 'center',
      background: 'var(--surface-2)',
    }"
  >
    <p :style="{ margin: 0, fontSize: '18px', fontWeight: 500 }">{{ title }}</p>
    <p
      v-if="message"
      :style="{ margin: '0 0 12px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }"
    >
      {{ message }}
    </p>
    <div :style="{ width: '100%', maxWidth: '280px' }">
      <slot />
    </div>
  </main>
</template>
