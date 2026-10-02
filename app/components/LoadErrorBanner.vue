<script setup lang="ts">
/**
 * 「資料載入失敗」橫條＋重試鍵。請假／銷假／紀錄頁共用。
 * 載入失敗時畫面保留舊資料，用這條提示「可能不是最新」，而不是把故障顯示成「沒有資料」。
 */
const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <div
    role="alert"
    :style="{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '10px',
      background: 'var(--bg-danger)',
      borderRadius: '10px',
      padding: '10px 12px',
      marginBottom: '12px',
      fontSize: '13px',
      color: 'var(--text-danger)',
    }"
  >
    <span>資料載入失敗，畫面可能不是最新</span>
    <button
      type="button"
      :style="{
        flex: 'none',
        borderWidth: '0.5px',
        borderStyle: 'solid',
        borderColor: 'var(--text-danger)',
        background: 'transparent',
        color: 'var(--text-danger)',
        borderRadius: '8px',
        padding: '6px 12px',
        fontSize: '13px',
      }"
      @click="emit('retry')"
    >
      重試
    </button>
  </div>
</template>
