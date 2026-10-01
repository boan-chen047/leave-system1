<script setup lang="ts">
import { computed } from 'vue';
import { Clock, MapPin, Hourglass, Users } from '@lucide/vue';
import { formatSessionDate, formatTimeRange, formatDeadline } from '~/utils/date';
import type { BadgeStatus, SessionRow } from '#shared/types';

const props = defineProps<{ session: SessionRow; badge: BadgeStatus }>();

// 彩色框（加開藍／已請假金）用 1px 更明顯；一般卡靠白底就浮得出來
const borderColor = computed(() =>
  props.badge === 'leave'
    ? 'var(--border-warning)'
    : props.session.kind === 'extra'
      ? 'var(--border-accent)'
      : 'var(--border)',
);
const borderWidth = computed(() =>
  props.badge === 'leave' || props.session.kind === 'extra' ? '1px' : '0.5px',
);

// 卡片給白底（像設計圖那樣浮在杏色頁面上），邊界才清楚。
// template 最外層只能有一個 <div>，註解寫在這裡（放在根元素旁會變多根節點、樣式透傳失效）。
const infoRow ={ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' };
</script>

<template>
  <div
    :style="{
      background: 'var(--surface-1)',
      // 寬／樣式／顏色分開寫（不用 border 簡寫＋CSS 變數，避免各環境解析不一致）
      borderWidth,
      borderStyle: 'solid',
      borderColor,
      borderRadius: '12px',
      padding: '14px',
      marginBottom: '12px',
    }"
  >
    <div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }">
      <div :style="{ minWidth: 0 }">
        <!-- 日期單行：不換行，才不會被右側徽章擠成兩排 -->
        <p :style="{ margin: 0, fontSize: '16px', fontWeight: 500, whiteSpace: 'nowrap' }">
          {{ formatSessionDate(session.sessionDate) }}
        </p>
        <p :style="{ ...infoRow, margin: '6px 0 0', fontSize: '14px' }">
          <Clock :size="15" aria-hidden="true" />
          {{ formatTimeRange(session.startTime, session.endTime) }}
        </p>
        <p :style="{ ...infoRow, margin: '2px 0 0', fontSize: '14px' }">
          <MapPin :size="15" aria-hidden="true" />
          {{ session.location }}
        </p>
        <p v-if="typeof session.leaveCount === 'number'" :style="{ ...infoRow, margin: '2px 0 0', fontSize: '14px' }">
          <Users :size="15" aria-hidden="true" />
          目前 {{ session.leaveCount }} 人請假
        </p>
        <p
          v-if="session.leaveDeadline"
          :style="{ ...infoRow, margin: '2px 0 0', fontSize: '13px', color: 'var(--text-muted)' }"
        >
          <Hourglass :size="14" aria-hidden="true" />
          截止 {{ formatDeadline(session.leaveDeadline) }}
        </p>
      </div>
      <UiBadge :status="badge" />
    </div>
    <p
      v-if="session.description"
      :style="{
        margin: '10px 0 0',
        fontSize: '14px',
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
      }"
    >
      <span :style="{ color: '#004B97' }">備註：</span>{{ session.description }}
    </p>
    <!-- 卡片下方的動作按鈕（請假／銷假等），由使用的頁面放進來 -->
    <div v-if="$slots.action" :style="{ marginTop: '12px' }">
      <slot name="action" />
    </div>
  </div>
</template>
