<script setup lang="ts">
/**
 * 元件預覽頁（只供開發確認外觀，資料全是示範用的假資料）。
 * 改寫期間用來比對 Nuxt 版與原 Next.js 版的元件長得一樣；全部功能完成後可移除。
 */
import { ref } from 'vue';
import type { SessionRow } from '~/types';

const base: SessionRow = {
  id: 'demo-1',
  sessionDate: '2026-10-09',
  startTime: '19:30:00',
  endTime: '22:00:00',
  location: 'NVA',
  kind: 'regular',
  leaveCount: 1,
  leaveDeadline: '2026-10-06T15:59:00.000Z', // 台北 10/6（二）23:59
};

const samples: { title: string; session: SessionRow; badge: 'attend' | 'extra' | 'leave' | 'ended' }[] = [
  { title: '一般場次（可請假）', session: base, badge: 'attend' },
  {
    title: '加開場次＋備註',
    session: { ...base, id: 'demo-2', sessionDate: '2026-10-15', kind: 'extra', leaveCount: 0, description: '友誼賽，記得帶護膝' },
    badge: 'extra',
  },
  {
    title: '已過截止（按鈕反灰）',
    session: { ...base, id: 'demo-3', sessionDate: '2026-10-02', leaveDeadline: '2026-09-29T15:59:00.000Z', leaveClosed: true },
    badge: 'attend',
  },
  { title: '已請假（銷假頁）', session: { ...base, id: 'demo-4', sessionDate: '2026-10-16' }, badge: 'leave' },
];

const dialogOpen = ref(false);
const section = { margin: '20px 0 10px', fontSize: '15px', fontWeight: 500 };
</script>

<template>
  <div
    :style="{
      background: 'var(--bg-warning)',
      borderRadius: '10px',
      padding: '10px 12px',
      marginBottom: '16px',
      fontSize: '13px',
      color: 'var(--text-warning)',
    }"
  >
    元件預覽頁：以下全部是<strong>示範資料</strong>，只用來確認外觀。
  </div>

  <p :style="{ ...section, marginTop: 0 }">統計卡</p>
  <div :style="{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }">
    <UiStatCard label="10 月出席" value="3 場" />
    <UiStatCard label="10 月已請假" value="1 場" />
  </div>

  <p :style="section">狀態徽章</p>
  <div :style="{ display: 'flex', gap: '8px', flexWrap: 'wrap' }">
    <UiBadge status="leave" />
    <UiBadge status="extra" />
    <UiBadge status="attend" />
    <UiBadge status="ended" />
  </div>

  <p :style="section">場次卡</p>
  <div v-for="s in samples" :key="s.session.id">
    <p :style="{ margin: '0 0 6px', fontSize: '13px', color: 'var(--text-muted)' }">{{ s.title }}</p>
    <SessionCard :session="s.session" :badge="s.badge">
      <template #action>
        <UiButton v-if="s.badge === 'leave'">銷假</UiButton>
        <UiButton v-else-if="s.session.leaveClosed" disabled>已截止</UiButton>
        <UiButton v-else>請假</UiButton>
      </template>
    </SessionCard>
  </div>

  <p :style="section">按鈕</p>
  <div :style="{ display: 'grid', gap: '10px' }">
    <UiButton variant="primary">主要（primary）</UiButton>
    <UiButton>次要（secondary）</UiButton>
    <UiButton variant="danger">危險（danger，如刪除帳號）</UiButton>
    <UiButton variant="pink">警示（pink，如停用帳號）</UiButton>
    <UiButton variant="ghost">文字（ghost，如取消）</UiButton>
    <UiButton variant="primary" disabled>停用狀態</UiButton>
  </div>

  <p :style="section">彈窗</p>
  <UiButton @click="dialogOpen = true">打開示範彈窗</UiButton>
  <UiDialog :open="dialogOpen" title="確定要請這場的假？">
    <p :style="{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center' }">
      2026/10/09（五）19:30–22:00
    </p>
    <template #footer>
      <UiButton variant="danger" :style="{ marginBottom: '12px' }" @click="dialogOpen = false">確定請假</UiButton>
      <UiButton variant="ghost" @click="dialogOpen = false">取消</UiButton>
    </template>
  </UiDialog>
</template>
