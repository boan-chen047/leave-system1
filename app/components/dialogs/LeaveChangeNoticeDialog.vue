<script setup lang="ts">
import { ref, watch } from 'vue';
import { api } from '~/utils/api';
import { formatSessionDate, formatTimeRange } from '#shared/utils/date';
import type { LeaveChangeNotice, SessionSlot } from '#shared/types';

/**
 * 「你請假的場次有異動」彈窗。
 * 管理員把我請假的場次改了日期／時間後，下次打開 App 跳出，列出「原 → 新」；
 * 請假仍有效，新時間能來的話可以去銷假。按「知道了」或「去銷假」即標為已讀、不再跳。
 *
 * - enabled：首次設定都完成後才查，避免跟設定彈窗疊在一起。
 * - onCancelPage：已經在銷假頁就不顯示「去銷假」。
 * 與 Next.js 版差異：原本只掛在首頁與銷假頁；這裡由 AuthGate 掛在所有需登入的頁面。
 */
const props = withDefaults(defineProps<{ enabled: boolean; onCancelPage?: boolean }>(), { onCancelPage: false });

const notices = ref<LeaveChangeNotice[]>([]);
const busy = ref(false);

const slotText = (s: SessionSlot) => `${formatSessionDate(s.date)} ${formatTimeRange(s.start, s.end)}`;

watch(
  () => props.enabled,
  async (on) => {
    if (!on) return;
    const r = await api<LeaveChangeNotice[]>('/api/me/notices');
    // 查不到不影響主畫面，下次打開再試
    if (r.ok && Array.isArray(r.data)) notices.value = r.data;
  },
  { immediate: true },
);

async function acknowledge(goCancel = false) {
  busy.value = true;
  // 標記失敗：下次打開會再提醒一次，不擋使用者
  await api('/api/me/notices', { method: 'POST', body: { ids: notices.value.map((n) => n.id) } });
  busy.value = false;
  notices.value = [];
  if (goCancel) await navigateTo('/cancel');
}
</script>

<template>
  <UiDialog :open="notices.length > 0" title="你請假的場次有異動">
    <div
      v-for="n in notices"
      :key="n.id"
      :style="{
        background: 'var(--surface-1)',
        borderWidth: '0.5px',
        borderStyle: 'solid',
        borderColor: 'var(--border)',
        borderRadius: '10px',
        padding: '10px 12px',
        marginBottom: '10px',
        fontSize: '14px',
        lineHeight: 1.7,
      }"
    >
      <div :style="{ color: 'var(--text-muted)', textDecoration: 'line-through' }">原 {{ slotText(n.from) }}</div>
      <div :style="{ fontWeight: 500 }">新 {{ slotText(n.to) }}</div>
    </div>
    <p :style="{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }">
      仍視為請假。如果新時間可以來，請到「銷假」頁銷假。
    </p>
    <template #footer>
      <UiButton variant="primary" :disabled="busy" :style="{ marginBottom: '12px' }" @click="acknowledge()">
        知道了
      </UiButton>
      <UiButton v-if="!onCancelPage" :disabled="busy" @click="acknowledge(true)">去銷假</UiButton>
    </template>
  </UiDialog>
</template>
