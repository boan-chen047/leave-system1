<script setup lang="ts">
import { computed, type CSSProperties } from 'vue';

type Variant = 'primary' | 'secondary' | 'danger' | 'pink' | 'ghost';

const props = withDefaults(defineProps<{ variant?: Variant; disabled?: boolean }>(), {
  variant: 'secondary',
  disabled: false,
});

// 可點元件的高度只有兩種：主要動作 52px，其餘一律 48px
const HEIGHT: Record<Variant, string> = {
  primary: '52px',
  danger: '52px',
  pink: '48px',
  secondary: '48px',
  ghost: '48px',
};

const STYLE: Record<Variant, CSSProperties> = {
  primary: { background: 'var(--fill-accent)', color: 'var(--on-accent)', border: 'none', fontWeight: 500 },
  danger: { background: 'var(--fill-danger)', color: 'var(--on-danger)', border: 'none' },
  // 停用帳號：粉紅底（可回復的警示動作，比刪除溫和）
  pink: { background: 'var(--fill-pink)', color: 'var(--on-pink)', border: 'none', fontWeight: 500 },
  secondary: {
    background: 'transparent',
    color: 'var(--text-primary)',
    border: '0.5px solid var(--border)',
  },
  ghost: { background: 'transparent', color: 'var(--text-secondary)', border: 'none' },
};

// 外部傳入的 style / class / onClick 會自動合併到 <button>（Vue 的屬性透傳）。
// 注意：template 最外層不能在 <button> 旁放 HTML 註解——開發模式會變成多個根節點，
// 透傳失效（點了沒反應、外部間距消失）。註解一律寫在 script 裡。
const style = computed<CSSProperties>(() => ({
  width: '100%',
  height: HEIGHT[props.variant],
  fontSize: '16px',
  borderRadius: '12px',
  cursor: props.disabled ? 'default' : 'pointer',
  opacity: props.disabled ? 0.55 : 1,
  ...STYLE[props.variant],
}));
</script>

<template>
  <button type="button" :disabled="disabled" :style="style">
    <slot />
  </button>
</template>
