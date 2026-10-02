<script setup lang="ts">
import { formatSessionDate, formatTimeRange } from '#shared/utils/date';
import type { SessionRow } from '#shared/types';

/**
 * 確認框裡的「是哪一場」：日期、時間、地點置中顯示。
 * 請假、銷假等不可逆動作的確認框一定要放，避免按錯場次。
 */
defineProps<{ session: Pick<SessionRow, 'sessionDate' | 'startTime' | 'endTime' | 'location'> }>();
</script>

<template>
  <div :style="{ padding: '14px 6px', textAlign: 'center' }">
    <p :style="{ margin: 0, fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)' }">
      {{ formatSessionDate(session.sessionDate) }}
    </p>
    <p :style="{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }">
      {{ formatTimeRange(session.startTime, session.endTime) }}
    </p>
    <p :style="{ margin: '2px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }">
      {{ session.location }}
    </p>
  </div>
</template>
