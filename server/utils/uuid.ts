/**
 * 是否為 UUID 字串（8-4-4-4-12 十六進位，不分大小寫）。
 * 資料庫 id 都是 uuid；把非 uuid 字串丟進查詢，Postgres 會丟 22P02（invalid input syntax），
 * 變成 500。API 收到外部傳入的 id 時先用這個擋掉，回 400「格式錯誤」。
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}
