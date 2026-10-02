<script setup lang="ts">
import { ref, watch } from 'vue';
import { api } from '~/utils/api';

/**
 * 名字對話框（填名字或綽號都可以，不強制真名）。
 * mode=first：首次設定第一關，預填 LINE 名稱讓使用者確認／微調，不能關閉。
 * mode=edit：個人頁修改，預填目前名字，可取消。
 */
const props = defineProps<{ open: boolean; mode: 'first' | 'edit' }>();
const emit = defineEmits<{ saved: []; close: [] }>();

const { me } = useMe();
const value = ref('');
const error = ref('');
const saving = ref(false);

// 每次打開都重新帶入目前的值（Next.js 版只在第一次掛載時帶入，關掉再開會留著上次沒存的字）
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    value.value = me.value?.realName ?? me.value?.displayName ?? '';
    error.value = '';
  },
  { immediate: true },
);

async function save() {
  const name = value.value.trim();
  if (!name) {
    error.value = '請填寫名字';
    return;
  }
  saving.value = true;
  const r = await api('/api/me', { method: 'PATCH', body: { realName: name } }, '儲存失敗');
  saving.value = false;
  if (!r.ok) {
    error.value = r.error;
    return;
  }
  emit('saved');
}
</script>

<template>
  <UiDialog :open="open" :title="mode === 'first' ? '確認你的名字' : '修改名字'">
    <!-- 內容少時在內容區垂直置中，不會擠在頂端看起來偏上 -->
    <div :style="{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }">
      <p
        v-if="mode === 'first'"
        :style="{ margin: '0 0 12px', fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center' }"
      >
        填名字或綽號都可以，管理員用它對照名單
      </p>
      <UiInput
        v-model="value"
        placeholder="你的名字或綽號"
        aria-label="名字"
        maxlength="20"
        @input="error = ''"
      />
      <UiErrorText :message="error" />
    </div>
    <template #footer>
      <UiButton variant="primary" :disabled="saving" :style="{ marginBottom: '12px' }" @click="save">
        {{ saving ? '儲存中…' : mode === 'first' ? '下一步' : '儲存' }}
      </UiButton>
      <p
        v-if="mode === 'first'"
        :style="{
          margin: 0,
          height: '48px',
          lineHeight: '48px',
          fontSize: '13px',
          color: 'var(--text-muted)',
          textAlign: 'center',
        }"
      >
        之後可在「個人」頁修改
      </p>
      <UiButton v-else variant="ghost" @click="emit('close')">取消</UiButton>
    </template>
  </UiDialog>
</template>
