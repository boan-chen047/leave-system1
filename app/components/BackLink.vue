<script setup lang="ts">
/** 公開頁（如隱私權政策）的返回鍵：有上一頁就回上一頁，沒有（直接開啟）就回首頁。 */
function back() {
  if (window.history.length > 1) window.history.back();
  else void navigateTo('/');
}
</script>

<template>
  <button
    type="button"
    :style="{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      border: 'none',
      background: 'none',
      padding: 0,
      marginBottom: '16px',
      fontSize: '15px',
      color: 'var(--text-accent)',
      cursor: 'pointer',
    }"
    @click="back"
  >
    ← 返回
  </button>
</template>
