<script setup lang="ts">
/**
 * 通用確認框：停用／刪除／重新啟用／銷假等重要動作用。
 * 內容放 default 插槽；確認鍵 danger=true 時紅底（刪除類動作），否則藍底。
 */
withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    confirmLabel: string;
    cancelLabel?: string;
    danger?: boolean;
    busy?: boolean;
    error?: string;
  }>(),
  { cancelLabel: '取消', danger: false, busy: false, error: '' },
);
const emit = defineEmits<{ confirm: []; cancel: [] }>();
</script>

<template>
  <UiDialog :open="open" :title="title">
    <div :style="{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.8 }">
      <slot />
    </div>
    <UiErrorText :message="error" />
    <template #footer>
      <UiButton
        :variant="danger ? 'danger' : 'primary'"
        :disabled="busy"
        :style="{ marginBottom: '12px' }"
        @click="emit('confirm')"
      >
        {{ busy ? '處理中…' : confirmLabel }}
      </UiButton>
      <UiButton variant="ghost" :disabled="busy" @click="emit('cancel')">{{ cancelLabel }}</UiButton>
    </template>
  </UiDialog>
</template>
