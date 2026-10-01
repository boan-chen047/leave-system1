/**
 * 儲存退費途徑（首次設定第三關、之後在個人頁也可改）。可多選 LINE PAY／銀行轉帳；
 * 選銀行必填代號與帳號。body: { refundLinePay, refundBank, bankCode, bankAccount }
 *
 * 格式檢查用 shared/utils/banks.ts，與前端退費對話框同一份規則
 * （Next.js 版是前後端各寫一份正規表示式）。
 */
export default defineEventHandler(async (event) => {
  const user = await currentUser(event);
  if (!user) return fail(event, 401, '未登入');

  const body = await readJson(event);
  const linePay = body.refundLinePay === true;
  const bank = body.refundBank === true;
  if (!linePay && !bank) return fail(event, 400, '請至少選一種退費途徑');

  let bankCode: string | null = null;
  let bankAccount: string | null = null;
  if (bank) {
    const code = typeof body.bankCode === 'string' ? body.bankCode.trim() : '';
    const account = typeof body.bankAccount === 'string' ? normalizeDigits(body.bankAccount) : '';
    const err = validateBankCode(code) ?? validateBankAccount(account);
    if (err) return fail(event, 400, err);
    bankCode = code;
    bankAccount = account;
  }

  const { error } = await supabaseAdmin()
    .from('users')
    .update({
      refund_line_pay: linePay,
      refund_bank: bank,
      bank_code: bankCode,
      bank_account: bankAccount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);
  if (error) return fail(event, 500, '儲存失敗');

  return { ok: true };
});
