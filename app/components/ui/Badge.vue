<script setup lang="ts">
import { computed } from 'vue';
import type { BadgeStatus } from '#shared/types';

const props = defineProps<{ status: BadgeStatus }>();

// 視覺層級由強到弱：已請假 > 加開 > 出席 > 已結束。
// 「已請假」是唯一代表使用者做過事的狀態，用實心色，要一眼掃到。
const MAP: Record<BadgeStatus, { text: string; bg: string; fg: string; weight: number }> = {
  leave: { text: '已請假', bg: 'var(--fill-warning)', fg: 'var(--on-warning)', weight: 500 },
  extra: { text: '加開', bg: 'var(--bg-accent)', fg: 'var(--text-accent)', weight: 400 },
  attend: { text: '出席', bg: 'var(--bg-success)', fg: 'var(--text-success)', weight: 400 },
  ended: { text: '已結束', bg: 'var(--fill-control)', fg: 'var(--text-secondary)', weight: 400 },
};

const s = computed(() => MAP[props.status]);
</script>

<template>
  <span
    :style="{
      background: s.bg,
      color: s.fg,
      fontWeight: s.weight,
      fontSize: '12px',
      padding: '4px 10px',
      borderRadius: '20px',
      whiteSpace: 'nowrap',
    }"
  >
    {{ s.text }}
  </span>
</template>
