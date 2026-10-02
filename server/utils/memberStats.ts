import type { SupabaseClient } from '@supabase/supabase-js';
import type { MemberStats } from '#shared/types';
import { sessionHasEnded, taipeiToday } from '#shared/utils/date';
import { periodCovers } from './membership';

/** 兩年保留下限＝台北今天往前兩年（用 Date.UTC 運算，閏日 2/29 自動進位到 3/1，不會產生無效日期） */
function twoYearsAgo(now: Date): string {
  const [y = NaN, m = NaN, d = NaN] = taipeiToday(now).split('-').map(Number);
  return new Date(Date.UTC(y - 2, m - 1, d)).toISOString().slice(0, 10);
}

/**
 * 算某人在 [from, to] 的出席／請假統計與請假明細。成員自己的首頁、紀錄頁與
 * 後台「依個人查」共用同一套邏輯，確保數字一致。
 *
 * - 在隊與否以 membership_periods（多段在隊期間）判定，與資料庫月報 build_summary 一致；
 *   中途退隊再回鍋的人，不在隊那段不算。日期一律用台北日期。
 * - 起日再套兩年保留下限（兩年前的明細會被清理）。
 * - 出席／請假只統計「已結束」的場次：還沒打或進行中的場次沒有出席結果，不能算成已出席。
 *
 * now 可注入以利測試。回傳 null 代表查詢失敗。
 */
export async function computeMemberStats(
  db: SupabaseClient,
  opts: { userId: string; from: string; to: string; now?: Date },
): Promise<MemberStats | null> {
  const now = opts.now ?? new Date();
  const floor = twoYearsAgo(now);
  const start = opts.from > floor ? opts.from : floor;
  const end = opts.to;

  const { data: periods, error: pErr } = await db
    .from('membership_periods')
    .select('started_on, ended_on')
    .eq('user_id', opts.userId);
  if (pErr) return null;
  const inTeam = (d: string) => (periods ?? []).some((p) => periodCovers(p, d));

  const { data: sessions, error: sErr } = await db
    .from('sessions')
    .select('id, session_date, start_time, end_time, location, kind')
    .gte('session_date', start)
    .lte('session_date', end)
    .eq('is_cancelled', false);
  if (sErr) return null;

  const inTeamSessions = (sessions ?? []).filter((s) => inTeam(s.session_date));
  // 起日被兩年下限往後推、或有場次因不在隊而被排除，都要提示「實際區間已調整」。
  // 未來場次被排除「不算」truncated——否則本月／本季／本年每次都會誤跳提示。
  const truncated = start !== opts.from || inTeamSessions.length !== (sessions ?? []).length;
  const ended = inTeamSessions.filter((s) => sessionHasEnded(s.session_date, s.end_time, now));
  const endedIds = new Set(ended.map((s) => s.id));

  if (inTeamSessions.length === 0) {
    return {
      sessionsCount: 0,
      leaveCount: 0,
      attendCount: 0,
      upcomingLeaveCount: 0,
      leaves: [],
      appliedFrom: start,
      appliedTo: end,
      truncated,
    };
  }

  // 在隊場次（含還沒結束的）的請假一次查出，再依「已結束／未結束」拆開
  const { data: leaves, error: lErr } = await db
    .from('leave_requests')
    .select('id, created_at, session_id')
    .eq('user_id', opts.userId)
    .eq('status', 'active')
    .in(
      'session_id',
      inTeamSessions.map((s) => s.id),
    );
  if (lErr) return null;

  const upcomingLeaveCount = (leaves ?? []).filter((l) => !endedIds.has(l.session_id)).length;
  const byId = new Map(ended.map((s) => [s.id, s]));
  const rows = (leaves ?? [])
    .filter((l) => endedIds.has(l.session_id))
    .map((l) => {
      const s = byId.get(l.session_id)!;
      return {
        id: l.id,
        createdAt: l.created_at,
        session: {
          id: s.id,
          sessionDate: s.session_date,
          startTime: s.start_time,
          endTime: s.end_time,
          location: s.location,
          kind: s.kind,
        },
      };
    })
    .sort((a, b) => b.session.sessionDate.localeCompare(a.session.sessionDate));

  return {
    sessionsCount: ended.length,
    leaveCount: rows.length,
    attendCount: ended.length - rows.length,
    upcomingLeaveCount,
    leaves: rows,
    appliedFrom: start,
    appliedTo: end,
    truncated,
  };
}
