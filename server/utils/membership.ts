import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 「在隊」的唯一定義：某人有一段 membership_periods 覆蓋該日
 * （started_on <= 日期，且 ended_on 為空或 ended_on > 日期；停用日當天起即不算）。
 *
 * 全系統同一條件——每場請假人數、個人統計（memberStats）、後台依場次查／代填請假候選名單、
 * 資料庫的 summarize_range／build_summary 都用它，數字才對得上。
 */

/** 一段在隊期間 */
export type Period = { user_id: string; started_on: string; ended_on: string | null };

/** 純函式：這段期間是否覆蓋該日（停用日當天起即不算） */
export function periodCovers(p: Pick<Period, 'started_on' | 'ended_on'>, date: string): boolean {
  return p.started_on <= date && (p.ended_on === null || p.ended_on > date);
}

/**
 * 某人在某日是否在隊（查資料庫）。後台代填請假會用到。
 * 查詢失敗丟錯，由呼叫端回 500，不把「查不到」當成「不在隊」。
 */
export async function isInTeamOn(db: SupabaseClient, userId: string, date: string): Promise<boolean> {
  const { data, error } = await db
    .from('membership_periods')
    .select('user_id')
    .eq('user_id', userId)
    .lte('started_on', date)
    .or(`ended_on.is.null,ended_on.gt.${date}`)
    .limit(1);
  if (error) throw new Error(`查詢在隊期間失敗：${error.message}`);
  return (data ?? []).length > 0;
}

/**
 * 每場「目前請假人數」：只算場次當天在隊者的有效請假。
 * 與後台「依場次查」同一定義——否則被停用的人若請過未來場次的假，成員卡片的
 * 「目前 N 人請假」會比後台多。
 * 查詢失敗丟錯，由呼叫端回 500，不顯示錯的人數。
 */
export async function leaveCountsBySession(
  db: SupabaseClient,
  sessions: { id: string; date: string }[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (sessions.length === 0) return counts;
  const dateById = new Map(sessions.map((s) => [s.id, s.date]));

  const { data: leaves, error } = await db
    .from('leave_requests')
    .select('session_id, user_id')
    .in('session_id', [...dateById.keys()])
    .eq('status', 'active');
  if (error) throw new Error(`查詢請假人數失敗：${error.message}`);
  if (!leaves || leaves.length === 0) return counts;

  const userIds = [...new Set(leaves.map((l) => l.user_id as string))];
  const { data: periods, error: pErr } = await db
    .from('membership_periods')
    .select('user_id, started_on, ended_on')
    .in('user_id', userIds);
  if (pErr) throw new Error(`查詢在隊期間失敗：${pErr.message}`);

  const byUser = new Map<string, Period[]>();
  for (const p of (periods ?? []) as Period[]) byUser.set(p.user_id, [...(byUser.get(p.user_id) ?? []), p]);

  for (const l of leaves) {
    const date = dateById.get(l.session_id as string);
    if (!date) continue;
    if ((byUser.get(l.user_id as string) ?? []).some((p) => periodCovers(p, date))) {
      counts.set(l.session_id as string, (counts.get(l.session_id as string) ?? 0) + 1);
    }
  }
  return counts;
}
