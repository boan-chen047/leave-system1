// 由 Next.js 版 tests/lib/membership.test.ts 原樣搬來（只改 import 路徑）。
import { describe, it, expect } from 'vitest';
import { isInTeamOn, periodCovers, leaveCountsBySession } from '#server/utils/membership';
import { fakeDb, ok, fail, type QueryLog } from '../helpers/fakeDb';

describe('periodCovers（與 isInTeamOn 同條件）', () => {
  const p = { user_id: 'u', started_on: '2026-09-10', ended_on: '2026-09-20' };
  it('起日當天算在隊', () => expect(periodCovers(p, '2026-09-10')).toBe(true));
  it('起日前不算', () => expect(periodCovers(p, '2026-09-09')).toBe(false));
  it('停用日前一天仍算', () => expect(periodCovers(p, '2026-09-19')).toBe(true));
  it('停用日當天起不算', () => expect(periodCovers(p, '2026-09-20')).toBe(false));
  it('未結束的期間一直算', () => expect(periodCovers({ ...p, ended_on: null }, '2030-01-01')).toBe(true));
});

describe('leaveCountsBySession（每場目前請假人數，只算當天在隊者）', () => {
  const sessions = [
    { id: 's-0925', date: '2026-09-25' },
    { id: 's-1002', date: '2026-10-02' },
  ];

  it('被停用者（停用日在場次之前）的請假不計入；其餘照算', async () => {
    const { db } = fakeDb({
      tables: {
        leave_requests: ok([
          { session_id: 's-0925', user_id: 'active' },
          { session_id: 's-1002', user_id: 'active' },
          { session_id: 's-1002', user_id: 'left' }, // 9/28 被停用，10/02 已不在隊
          { session_id: 's-0925', user_id: 'left' }, // 9/25 時還在隊 → 算
        ]),
        membership_periods: ok([
          { user_id: 'active', started_on: '2026-09-01', ended_on: null },
          { user_id: 'left', started_on: '2026-09-01', ended_on: '2026-09-28' },
        ]),
      },
    });
    const counts = await leaveCountsBySession(db as never, sessions);
    expect(counts.get('s-0925')).toBe(2);
    expect(counts.get('s-1002')).toBe(1);
  });

  it('回鍋成員：以涵蓋場次日期的那一段期間判定', async () => {
    const { db } = fakeDb({
      tables: {
        leave_requests: ok([{ session_id: 's-1002', user_id: 'back' }]),
        membership_periods: ok([
          { user_id: 'back', started_on: '2026-01-01', ended_on: '2026-03-01' },
          { user_id: 'back', started_on: '2026-09-30', ended_on: null },
        ]),
      },
    });
    expect((await leaveCountsBySession(db as never, sessions)).get('s-1002')).toBe(1);
  });

  it('沒有場次或沒有請假 → 不查在隊期間', async () => {
    const empty = fakeDb();
    expect((await leaveCountsBySession(empty.db as never, [])).size).toBe(0);
    expect(empty.log.queries).toHaveLength(0);

    const noLeaves = fakeDb({ tables: { leave_requests: ok([]) } });
    await leaveCountsBySession(noLeaves.db as never, sessions);
    expect(noLeaves.log.queries.map((q: QueryLog) => q.table)).toEqual(['leave_requests']);
  });

  it('查詢失敗要丟錯（不顯示錯的人數）', async () => {
    const { db } = fakeDb({ tables: { leave_requests: fail('down') } });
    await expect(leaveCountsBySession(db as never, sessions)).rejects.toThrow('查詢請假人數失敗');
  });
});

// 依 isInTeamOn 的查詢鏈 mock：from().select().eq().lte().or().limit()，並記下套用的條件
function mockDb(result: { data: unknown[] | null; error: { message: string } | null }) {
  const calls: Record<string, unknown> = {};
  const db = {
    from(table: string) {
      calls.table = table;
      return {
        select: () => ({
          eq: (col: string, v: string) => {
            calls.eq = [col, v];
            return {
              lte: (col2: string, v2: string) => {
                calls.lte = [col2, v2];
                return {
                  or: (expr: string) => {
                    calls.or = expr;
                    return { limit: async () => result };
                  },
                };
              },
            };
          },
        }),
      };
    },
  } as any;
  return { db, calls };
}

describe('isInTeamOn', () => {
  it('有覆蓋當日的在隊期間 → true，且條件與全系統在隊定義一致', async () => {
    const { db, calls } = mockDb({ data: [{ user_id: 'u1' }], error: null });
    expect(await isInTeamOn(db, 'u1', '2026-10-02')).toBe(true);
    expect(calls.table).toBe('membership_periods');
    expect(calls.eq).toEqual(['user_id', 'u1']);
    expect(calls.lte).toEqual(['started_on', '2026-10-02']);
    // 停用日當天起即不算在隊 → ended_on 必須「大於」該日（不是大於等於）
    expect(calls.or).toBe('ended_on.is.null,ended_on.gt.2026-10-02');
  });

  it('沒有覆蓋當日的期間 → false', async () => {
    const { db } = mockDb({ data: [], error: null });
    expect(await isInTeamOn(db, 'u1', '2026-10-02')).toBe(false);
  });

  it('查詢失敗要丟錯，不能把「查不到」當成「不在隊」', async () => {
    const { db } = mockDb({ data: null, error: { message: 'boom' } });
    await expect(isInTeamOn(db, 'u1', '2026-10-02')).rejects.toThrow('查詢在隊期間失敗：boom');
  });
});
