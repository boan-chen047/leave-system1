// 退費用的銀行代號（機構代號）清單與格式檢查。
// 代號＝台灣金融機構 3 碼代號；使用者可從下拉選，也可自行輸入（含分行的 7 碼也接受）。
// 格式規則刻意與後端 /api/me/refund 一致：代號 3～7 位數字、帳號 5～20 位數字。

/** 常用台灣銀行／機構代號（3 碼）。非窮舉，允許使用者自行輸入清單外代號。 */
export const BANK_CODES: { code: string; name: string }[] = [
  { code: '004', name: '臺灣銀行' },
  { code: '005', name: '土地銀行' },
  { code: '006', name: '合作金庫' },
  { code: '007', name: '第一銀行' },
  { code: '008', name: '華南銀行' },
  { code: '009', name: '彰化銀行' },
  { code: '011', name: '上海商銀' },
  { code: '012', name: '台北富邦' },
  { code: '013', name: '國泰世華' },
  { code: '017', name: '兆豐銀行' },
  { code: '021', name: '花旗（台灣）' },
  { code: '048', name: '王道銀行' },
  { code: '050', name: '臺灣企銀' },
  { code: '052', name: '渣打銀行' },
  { code: '053', name: '台中銀行' },
  { code: '054', name: '京城銀行' },
  { code: '081', name: '匯豐（台灣）' },
  { code: '101', name: '瑞興銀行' },
  { code: '103', name: '新光銀行' },
  { code: '108', name: '陽信銀行' },
  { code: '118', name: '板信銀行' },
  { code: '147', name: '三信銀行' },
  { code: '700', name: '中華郵政' },
  { code: '803', name: '聯邦銀行' },
  { code: '805', name: '遠東商銀' },
  { code: '806', name: '元大銀行' },
  { code: '807', name: '永豐銀行' },
  { code: '808', name: '玉山銀行' },
  { code: '809', name: '凱基銀行' },
  { code: '810', name: '星展（台灣）' },
  { code: '812', name: '台新銀行' },
  { code: '815', name: '日盛銀行' },
  { code: '816', name: '安泰銀行' },
  { code: '822', name: '中國信託' },
];

/** 去掉空白與連字號（帳號常被貼成 1234-5678 或含空格） */
export function normalizeDigits(s: string): string {
  return s.replace(/[\s-]/g, '');
}

/** 檢查銀行代號格式；OK 回 null，否則回錯誤訊息（與後端一致：3～7 位數字）。 */
export function validateBankCode(code: string): string | null {
  const c = code.trim();
  if (!c) return '請填銀行代號';
  if (!/^\d{3,7}$/.test(c)) return '銀行代號應為 3～7 位數字';
  return null;
}

/** 檢查銀行帳號格式；OK 回 null，否則回錯誤訊息（與後端一致：5～20 位數字，允許空白/連字號）。 */
export function validateBankAccount(account: string): string | null {
  const a = normalizeDigits(account);
  if (!a) return '請填銀行帳號';
  if (!/^\d{5,20}$/.test(a)) return '帳號應為 5～20 位數字';
  return null;
}
