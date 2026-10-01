<script setup lang="ts">
import { Check } from '@lucide/vue';

/**
 * 可勾選的整列按鈕（例：退費途徑的 LINE PAY／銀行轉帳，可複選）。
 * 用法：<UiCheckRow v-model="linePay">LINE PAY</UiCheckRow>
 * 整列可點、有 aria-pressed，選中時藍框淺藍底＋實心勾勾。
 */
const checked = defineModel<boolean>({ default: false });
</script>

<template>
  <button
    type="button"
    :aria-pressed="checked"
    :style="{
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      height: '52px',
      padding: '0 14px',
      marginBottom: '10px',
      borderRadius: '12px',
      borderWidth: checked ? '1px' : '0.5px',
      borderStyle: 'solid',
      borderColor: checked ? 'var(--border-accent)' : 'var(--border)',
      background: checked ? 'var(--bg-accent)' : 'var(--surface-1)',
      color: 'var(--text-primary)',
      fontSize: '16px',
      textAlign: 'left',
    }"
    @click="checked = !checked"
  >
    <span
      :style="{
        width: '22px',
        height: '22px',
        borderRadius: '6px',
        borderWidth: '1.5px',
        borderStyle: 'solid',
        borderColor: checked ? 'var(--fill-accent)' : 'var(--border-strong)',
        background: checked ? 'var(--fill-accent)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }"
    >
      <Check v-if="checked" :size="15" color="var(--on-accent)" aria-hidden="true" />
    </span>
    <slot />
  </button>
</template>
