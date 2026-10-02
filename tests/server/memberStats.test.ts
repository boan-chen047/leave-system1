// 由 Next.js 版 tests/lib/memberStats.test.ts 原樣搬來（只改 import 路徑）。
import { describe, it, expect } from 'vitest';
import { computeMemberStats } from '#server/utils/memberStats';

type S = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  location: string;
  kind: string;
};
type L = { id: string; created_at: string; session_id: string };
type P = { started_on: string; ended_on: string | null };

// 依 computeMemberStats 的查詢鏈 mock：
//   membership_periods: from().select().eq()
//   sessions:           from().select().gte().lte().eq()
//   leave_requests:     from().select().eq().eq().in()
function mockDb(sessions: S[], leaves: L[], periods: P[]) {
  return {
    from(table: string) {
      if (table === 'membership_periods') {
        return { select: () => ({ eq: async () => ({ data: periods, error: null }) }) };
      }
      if (table === 'sessions') {
        return {
          select: () => ({
            gte: () => ({ lte: () => ({ eq: async () => ({ data: sessions, error: null }) }) }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({ eq: () => ({ in: async () => ({ data: leaves, error: null }) }) }),
        }),
      };
    },
  } as any;
}

const mkS = (id: string, date: string): S => ({
  id,
  session_date: date,
  start_time: '19:00:00',
  end_time: '21:00:00',
  location: '中山國中體育館',
  kind: 'regular',
});
const openPeriod: P = { started_on: '2020-01-01', ended_on: null };
// 這些案例要測「在隊/停用/兩年」等過濾，不想被「未來場次不計」干擾，
// 因此把 now 固定在所有 9 月場次都已結束之後（10/01），讓每場都算已結束。
const AFTER_SEP = new Date('2026-10-01T00:00:00+08:00');

describe('computeMemberStats', () => {
  it('出席 = 未取消場次數 − 有效請假數', async () => {
    const db = mockDb(
      [mkS('s1', '2026-09-08'), mkS('s2', '2026-09-15'), mkS('s3', '2026-09-22'), mkS('s4', '2026-09-29')],
      [{ id: 'l1', created_at: '2026-09-01T00:00:00Z', session_id: 's2' }],
      [openPeriod],
    );
    const r = await computeMemberStats(db, { userId: 'u1', from: '2026-09-01', to: '2026-09-30', now: AFTER_SEP });
    expect(r).not.toBeNull();
    expect(r!.sessionsCount).toBe(4);
    expect(r!.leaveCount).toBe(1);
    expect(r!.attendCount).toBe(3);
    expect(r!.truncated).toBe(false);
  });

  it('加入日之前的場次不算他的，並標記 truncated', async () => {
    // 09-20 才入隊：09-08 那場落在入隊前 → 被排除
    const db = mockDb(
      [mkS('s0', '2026-09-08'), mkS('s1', '2026-09-22'), mkS('s2', '2026-09-29')],
      [],
      [{ started_on: '2026-09-20', ended_on: null }],
    );
    const r = await computeMemberStats(db, { userId: 'u1', from: '2026-09-01', to: '2026-09-30', now: AFTER_SEP });
    expect(r!.sessionsCount).toBe(2);
    expect(r!.truncated).toBe(true);
  });

  it('區間內沒有場次時回 0，不去查請假', async () => {
    const db = mockDb([], [], [openPeriod]);
    const r = await computeMemberStats(db, { userId: 'u1', from: '2026-09-01', to: '2026-09-30', now: AFTER_SEP });
    expect(r!.sessionsCount).toBe(0);
    expect(r!.leaveCount).toBe(0);
    expect(r!.attendCount).toBe(0);
  });

  it('停用日(含)之後的場次不算他的（與月報一致）', async () => {
    // 期間結束於 09-16：09-08 算、09-22 不算
    const db = mockDb(
      [mkS('s1', '2026-09-08'), mkS('s2', '2026-09-22')],
      [],
      [{ started_on: '2020-01-01', ended_on: '2026-09-16' }],
    );
    const r = await computeMemberStats(db, { userId: 'u1', from: '2026-09-01', to: '2026-09-30', now: AFTER_SEP });
    expect(r!.sessionsCount).toBe(1);
    expect(r!.truncated).toBe(true);
  });

  it('未來（尚未結束）的場次不計入出席，且不因此標記 truncated', async () => {
    // now = 09-12 中午：09-08 已結束(21:00)；09-15/22/29 都還沒到 → 只 09-08 該計
    const now = new Date('2026-09-12T12:00:00+08:00');
    const db = mockDb(
      [mkS('s1', '2026-09-08'), mkS('s2', '2026-09-15'), mkS('s3', '2026-09-22'), mkS('s4', '2026-09-29')],
      [],
      [openPeriod],
    );
    const r = await computeMemberStats(db, { userId: 'u1', from: '2026-01-01', to: '2026-09-30', now });
    expect(r!.sessionsCount).toBe(1); // 只有 09-08 已結束
    expect(r!.attendCount).toBe(1); // 沒請假 → 出席 1（不是 4）
    expect(r!.leaveCount).toBe(0);
    expect(r!.truncated).toBe(false); // 排除未來場次不算「區間被調整」
  });

  it('當天但還沒到結束時刻的場次也不算已出席', async () => {
    // now = 場次當天 20:00，場次 19:00–21:00 尚未結束 → 不計
    const now = new Date('2026-09-08T20:00:00+08:00');
    const db = mockDb([mkS('s1', '2026-09-08')], [], [openPeriod]);
    const r = await computeMemberStats(db, { userId: 'u1', from: '2026-09-01', to: '2026-09-30', now });
    expect(r!.sessionsCount).toBe(0);
    expect(r!.attendCount).toBe(0);
  });

  it('還沒打的場次的請假另計 upcomingLeaveCount，不混進出席/請假統計與明細', async () => {
    // now = 09-24 中午：09-08 已結束且有請假；09-25、09-29 還沒打且有請假；09-15 已結束沒請假
    const now = new Date('2026-09-24T12:00:00+08:00');
    const db = mockDb(
      [mkS('s08', '2026-09-08'), mkS('s15', '2026-09-15'), mkS('s25', '2026-09-25'), mkS('s29', '2026-09-29')],
      [
        { id: 'l08', created_at: '2026-09-01T00:00:00Z', session_id: 's08' },
        { id: 'l25', created_at: '2026-09-20T00:00:00Z', session_id: 's25' },
        { id: 'l29', created_at: '2026-09-20T00:00:00Z', session_id: 's29' },
      ],
      [openPeriod],
    );
    const r = await computeMemberStats(db, { userId: 'u1', from: '2026-09-01', to: '2026-09-30', now });
    expect(r!.sessionsCount).toBe(2); // 已結束：09-08、09-15
    expect(r!.leaveCount).toBe(1); // 已結束場次的請假：09-08
    expect(r!.attendCount).toBe(1); // 09-15
    expect(r!.upcomingLeaveCount).toBe(2); // 09-25、09-29 已送出、還沒打
    expect(r!.leaves.map((l) => l.id)).toEqual(['l08']); // 明細只列已結束的
  });

  it('區間內只有未來場次時也會查請假（首頁月初送出的假要看得到）', async () => {
    const now = new Date('2026-09-01T12:00:00+08:00');
    const db = mockDb(
      [mkS('s25', '2026-09-25')],
      [{ id: 'l25', created_at: '2026-09-01T00:00:00Z', session_id: 's25' }],
      [openPeriod],
    );
    const r = await computeMemberStats(db, { userId: 'u1', from: '2026-09-01', to: '2026-09-30', now });
    expect(r!.sessionsCount).toBe(0);
    expect(r!.leaveCount).toBe(0);
    expect(r!.upcomingLeaveCount).toBe(1);
  });
});
