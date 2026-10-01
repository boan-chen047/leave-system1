<script setup lang="ts">
import { computed } from 'vue';
import { CalendarMinus, CalendarPlus, History, User, ShieldCheck } from '@lucide/vue';

type TabKey = 'leave' | 'cancel' | 'history' | 'profile' | 'admin';

const TABS = [
  { key: 'leave', label: '請假', to: '/', icon: CalendarPlus },
  { key: 'cancel', label: '銷假', to: '/cancel', icon: CalendarMinus },
  { key: 'history', label: '紀錄', to: '/history', icon: History },
  { key: 'profile', label: '個人', to: '/profile', icon: User },
  { key: 'admin', label: '後台', to: '/admin', icon: ShieldCheck },
] as const satisfies readonly { key: TabKey; label: string; to: string; icon: unknown }[];

const route = useRoute();
const { isAdmin } = useMe();

/**
 * 格數本身就是權限的視覺表現：一般使用者四格、管理員五格。
 * 權限不足的分頁直接不顯示，不做 disabled 也不放鎖頭。
 */
const tabs = computed(() => TABS.filter((t) => t.key !== 'admin' || isAdmin.value));

// 所在分頁由網址決定（原 Next.js 版是每頁傳 active 進來；Nuxt 用 route 判斷，頁面不用再傳）
const active = computed<TabKey | null>(() => {
  const p = route.path;
  if (p === '/') return 'leave';
  if (p.startsWith('/admin')) return 'admin';
  const hit = TABS.find((t) => t.to !== '/' && p.startsWith(t.to));
  return hit ? hit.key : null;
});
</script>

<template>
  <nav
    :style="{
      display: 'grid',
      gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
      borderTop: '0.5px solid var(--border)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      background: 'var(--surface-2)',
    }"
  >
    <NuxtLink
      v-for="t in tabs"
      :key="t.key"
      :to="t.to"
      :aria-current="active === t.key ? 'page' : undefined"
      :style="{
        textAlign: 'center',
        padding: '12px 0',
        textDecoration: 'none',
        color: active === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
        fontWeight: active === t.key ? 500 : 400,
      }"
    >
      <component :is="t.icon" :size="21" :style="{ display: 'block', margin: '0 auto' }" aria-hidden="true" />
      <!-- 所在分頁：文字下方加一條底線（排球藍），不用頂部橫槓 -->
      <span
        :style="{
          display: 'inline-block',
          fontSize: '12px',
          padding: '0 4px 3px',
          borderBottom: active === t.key ? '3px solid var(--border-accent)' : '3px solid transparent',
        }"
      >
        {{ t.label }}
      </span>
    </NuxtLink>
  </nav>
</template>
