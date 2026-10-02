<script setup lang="ts">
import { ref, watch } from 'vue';
import { api } from '~/utils/api';
import { BANK_CODES, normalizeDigits, validateBankCode, validateBankAccount } from '#shared/utils/banks';

/**
 * 退費途徑（首次設定第三關／個人頁修改）：可複選 LINE PAY／銀行轉帳；
 * 選銀行轉帳必填銀行代號與帳號。格式規則與後端同一份（shared/utils/banks.ts）。
 */
const props = defineProps<{ open: boolean; mode: 'first' | 'edit' }>();
const emit = defineEmits<{ saved: []; close: [] }>();

const { me } = useMe();
const linePay = ref(false);
const bank = ref(false);
const bankCode = ref('');
const bankAccount = ref('');
const error = ref('');
const saving = ref(false);

// 每次打開都帶入目前已存的設定
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    linePay.value = me.value?.refundLinePay ?? false;
    bank.value = me.value?.refundBank ?? false;
    bankCode.value = me.value?.bankCode ?? '';
    bankAccount.value = me.value?.bankAccount ?? '';
    error.value = '';
  },
  { immediate: true },
);
// 任何欄位一改就清掉舊的錯誤訊息
watch([linePay, bank, bankCode, bankAccount], () => (error.value = ''));

async function save() {
  if (!linePay.value && !bank.value) {
    error.value = '請至少選一種退費途徑';
    return;
  }
  // 選了銀行轉帳才檢查代號／帳號格式（前端先擋、給明確訊息；後端會再驗一次）
  if (bank.value) {
    const err = validateBankCode(bankCode.value) ?? validateBankAccount(bankAccount.value);
    if (err) {
      error.value = err;
      return;
    }
  }
  saving.value = true;
  const r = await api(
    '/api/me/refund',
    {
      method: 'PATCH',
      body: {
        refundLinePay: linePay.value,
        refundBank: bank.value,
        bankCode: bankCode.value.trim(),
        bankAccount: normalizeDigits(bankAccount.value),
      },
    },
    '儲存失敗',
  );
  saving.value = false;
  if (!r.ok) {
    error.value = r.error;
    return;
  }
  emit('saved');
}
</script>

<template>
  <UiDialog :open="open" title="退費途徑">
    <p :style="{ margin: '0 0 12px', fontSize: '14px', textAlign: 'center', lineHeight: 1.7 }">
      <span :style="{ color: '#e5392e' }">可複選。</span><br />
      <span :style="{ color: 'var(--text-secondary)' }">勾選 LINE PAY 者優先用它退費</span>
    </p>

    <UiCheckRow v-model="linePay">LINE PAY</UiCheckRow>
    <UiCheckRow v-model="bank">銀行轉帳</UiCheckRow>

    <div v-if="bank" :style="{ marginTop: '2px' }">
      <!-- 下拉可選常用銀行；value 只放代號，也允許自行輸入清單外代號（含分行 7 碼） -->
      <UiInput
        v-model="bankCode"
        list="bank-code-options"
        inputmode="numeric"
        placeholder="銀行代號（可選單或直接輸入，例：822）"
        aria-label="銀行代號"
        :style="{ marginBottom: '10px' }"
      />
      <datalist id="bank-code-options">
        <option v-for="b in BANK_CODES" :key="b.code" :value="b.code">{{ b.code }} {{ b.name }}</option>
      </datalist>
      <UiInput v-model="bankAccount" inputmode="numeric" placeholder="銀行帳號" aria-label="銀行帳號" />
      <p :style="{ margin: '16px 0 12px', fontSize: '13px', textAlign: 'center' }">
        <span :style="{ color: 'var(--text-secondary)' }">非中信用戶</span>
        <span :style="{ color: '#e5392e' }">扣15元</span>
      </p>
    </div>

    <UiErrorText :message="error" />

    <template #footer>
      <UiButton variant="primary" :disabled="saving" :style="{ marginBottom: '12px' }" @click="save">
        {{ saving ? '儲存中…' : mode === 'first' ? '完成，開始使用' : '儲存' }}
      </UiButton>
      <UiButton v-if="mode === 'edit'" variant="ghost" @click="emit('close')">取消</UiButton>
    </template>
  </UiDialog>
</template>
