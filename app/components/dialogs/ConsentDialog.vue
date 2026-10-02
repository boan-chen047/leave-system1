<script setup lang="ts">
import { ref } from 'vue';
import { api } from '~/utils/api';

/** 首次設定第二關：同意隱私權政策（記錄到現行版本）。政策升版後會再次跳出。 */
defineProps<{ open: boolean }>();
const emit = defineEmits<{ saved: [] }>();

const error = ref('');
const saving = ref(false);

async function agree() {
  error.value = '';
  saving.value = true;
  const r = await api('/api/me/terms', { method: 'PATCH' }, '儲存失敗');
  saving.value = false;
  if (!r.ok) {
    error.value = r.error;
    return;
  }
  emit('saved');
}

const li = { margin: '0 0 4px', fontSize: '14px', lineHeight: 1.7, color: 'var(--text-secondary)' };
</script>

<template>
  <UiDialog :open="open" title="使用前，請先同意條款">
    <p :style="{ margin: '0 0 10px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }">
      使用本系統即表示你同意我們的隱私權政策，重點：
    </p>
    <ul :style="{ margin: '0 0 10px', paddingLeft: '18px' }">
      <li :style="li">蒐集：暱稱（綽號）、LINE 資訊、退費途徑與銀行帳號、請假與出缺席。</li>
      <li :style="li">用途：請假管理與出缺席統計；不涉金流、不販售個資。</li>
      <li :style="li">連續 5 年未登入，將自動刪除你的帳號與所有個人資料。</li>
    </ul>
    <!-- inline-block＋下邊距：與貼底的「我同意」按鈕拉開距離（行內 <a> 的垂直 margin 會被忽略） -->
    <a
      href="/privacy"
      target="_blank"
      rel="noopener noreferrer"
      :style="{
        display: 'inline-block',
        marginBottom: '20px',
        fontSize: '14px',
        color: 'var(--text-accent)',
        textDecoration: 'underline',
      }"
    >
      閱讀完整隱私權政策
    </a>
    <UiErrorText :message="error" />
    <template #footer>
      <UiButton variant="primary" :disabled="saving" :style="{ marginBottom: '12px' }" @click="agree">
        {{ saving ? '處理中…' : '我同意並繼續' }}
      </UiButton>
    </template>
  </UiDialog>
</template>
