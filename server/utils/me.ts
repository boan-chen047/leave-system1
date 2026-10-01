import type { Me } from '#shared/types';

/** users 表欄位（/api/me 與登入回傳共用同一組，避免兩邊欄位不一致） */
export const ME_COLUMNS =
  'id, display_name, picture_url, real_name, role, is_active, terms_version, refund_line_pay, refund_bank, bank_code, bank_account';

type UserRow = {
  id: string;
  display_name: string;
  picture_url: string | null;
  real_name: string | null;
  role: Me['role'];
  is_active: boolean;
  terms_version: string | null;
  refund_line_pay: boolean;
  refund_bank: boolean;
  bank_code: string | null;
  bank_account: string | null;
};

/** 資料庫的 snake_case 列 → 前端用的 Me（camelCase） */
export function toMe(row: UserRow): Me {
  return {
    id: row.id,
    displayName: row.display_name,
    pictureUrl: row.picture_url,
    realName: row.real_name,
    role: row.role,
    isActive: row.is_active,
    termsVersion: row.terms_version,
    refundLinePay: row.refund_line_pay,
    refundBank: row.refund_bank,
    bankCode: row.bank_code,
    bankAccount: row.bank_account,
  };
}
