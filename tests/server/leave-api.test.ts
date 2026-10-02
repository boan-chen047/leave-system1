import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { harness, asRole, callApi } from '../helpers/nitro';
import { fakeDb, ok, fail, hasOp, type QueryLog } from '../helpers/fakeDb';

// 第 3 步請假頁用到的 API。案例由 Next.js 版 tests/api/leaves、sessionLists、notices 搬來，
// 另加 Nuxt 版新增的格式檢查。

const leavePost = () => import('#server/api/leaves/index.post');
const available = () => import('#server/api/sessions/available.get');
const statsMine = () => import('#server/api/stats/mine.get');
const noticesGet = () => import('#server/api/me/notices.get');
const noticesPost = () => import('#server/api/me/notices.post');

const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  harness.user = null;
  harness.db = fakeDb().db;
});
afterEach(() => vi.useRealTimers());

describe('POST /api/leaves（成員自己請假）', () => {
  // 場次 10/02（五）19:30 → 請假截止＝該週二 9/29 23:59（台北）
  const SESSION = { id: S1, session_date: '2026-10-02', start_time: '19:30:00', is_cancelled: false, announced_at: null };
  const BEFORE_DEADLINE = new Date('2026-09-24T12:00:00+08:00');
  const AFTER_DEADLINE = new Date('2026-09-30T10:00:00+08:00');
  beforeEach(() => vi.setSystemTime(BEFORE_DEADLINE));

  it('未登入 → 401', async () => {
    expect((await callApi(leavePost, { body: { sessionId: S1 } })).status).toBe(401);
  });

  it('缺 sessionId → 400；不是 uuid → 400，不查資料庫', async () => {
    asRole('member');
    const f = fakeDb();
    harness.db = f.db;
    expect((await callApi(leavePost, { body: {} })).status).toBe(400);
    expect((await callApi(leavePost, { body: null })).status).toBe(400);
    const bad = await callApi(leavePost, { body: { sessionId: 'abc' } });
    expect(bad).toEqual({ status: 400, data: { error: 'sessionId 格式錯誤' } });
    expect(f.log.queries).toHaveLength(0);
  });

  it('場次不存在 → 404', async () => {
    asRole('member');
    harness.db = fakeDb({ tables: { sessions: ok(null) } }).db;
    expect((await callApi(leavePost, { body: { sessionId: S1 } })).status).toBe(404);
  });

  it('場次已取消 → 409，且不會呼叫請假 RPC', async () => {
    asRole('member');
    const f = fakeDb({ tables: { sessions: ok({ ...SESSION, is_cancelled: true }) } });
    harness.db = f.db;
    expect((await callApi(leavePost, { body: { sessionId: S1 } })).status).toBe(409);
    expect(f.log.rpcs).toHaveLength(0);
  });

  it('過了請假截止（週二 23:59）→ 409，且不會呼叫請假 RPC', async () => {
    vi.setSystemTime(AFTER_DEADLINE);
    asRole('member');
    const f = fakeDb({ tables: { sessions: ok(SESSION) } });
    harness.db = f.db;
    const r = await callApi(leavePost, { body: { sessionId: S1 } });
    expect(r.status).toBe(409);
    expect(r.data.error).toContain('截止');
    expect(f.log.rpcs).toHaveLength(0);
  });

  it('成功 → 201，以「登入者本人」呼叫 self_file_leave（請假與操作紀錄同交易）', async () => {
    asRole('member', 'me');
    const f = fakeDb({ tables: { sessions: ok(SESSION) }, rpc: { self_file_leave: ok('leave-1') } });
    harness.db = f.db;
    expect(await callApi(leavePost, { body: { sessionId: S1 } })).toEqual({ status: 201, data: { id: 'leave-1' } });
    expect(f.log.rpcs).toEqual([{ name: 'self_file_leave', args: { p_session: S1, p_user: 'me' } }]);
  });

  it('重複請假（23505）→ 409', async () => {
    asRole('member');
    harness.db = fakeDb({
      tables: { sessions: ok(SESSION) },
      rpc: { self_file_leave: fail('duplicate', '23505') },
    }).db;
    const r = await callApi(leavePost, { body: { sessionId: S1 } });
    expect(r.status).toBe(409);
    expect(r.data.error).toContain('已經請過');
  });

  it('過週二截止後才公告的場次（臨時加開）→ 開打前仍可請假', async () => {
    vi.setSystemTime(AFTER_DEADLINE);
    asRole('member', 'me');
    harness.db = fakeDb({
      tables: { sessions: ok({ ...SESSION, announced_at: '2026-09-30T01:00:00Z' }) }, // 台北 9/30 09:00 才加開
      rpc: { self_file_leave: ok('leave-x') },
    }).db;
    expect((await callApi(leavePost, { body: { sessionId: S1 } })).status).toBe(201);
  });

  it('臨時加開的場次開打後 → 409', async () => {
    vi.setSystemTime(new Date('2026-10-02T19:30:00+08:00'));
    asRole('member');
    harness.db = fakeDb({ tables: { sessions: ok({ ...SESSION, announced_at: '2026-09-30T01:00:00Z' }) } }).db;
    expect((await callApi(leavePost, { body: { sessionId: S1 } })).status).toBe(409);
  });
});

describe('GET /api/sessions/available（首頁「接下來的場次」）', () => {
  // 現在：9/24（四）12:00 台北。本週 9/24、9/25 的週二截止（9/22 23:59）已過、但還沒開打。
  const OLD = '2026-09-01T00:00:00Z'; // 早就公告的場次（一般情況）
  const sess = (id: string, date: string, start = '19:30:00', extra: Record<string, unknown> = {}) => ({
    id,
    session_date: date,
    start_time: start,
    end_time: '22:00:00',
    location: 'NVA',
    kind: 'regular',
    description: null,
    announced_at: OLD,
    ...extra,
  });
  // 同一張表查兩次：有 in() 的是「全體請假人數」，沒有的是「我的請假」
  const db = (sessions: unknown[], mine: string[] = []) =>
    fakeDb({
      tables: {
        sessions: ok(sessions),
        leave_requests: (q: QueryLog) =>
          q.ops.some((o) => o[0] === 'in') ? ok([]) : ok(mine.map((session_id) => ({ session_id }))),
      },
    });

  beforeEach(() => {
    vi.setSystemTime(new Date('2026-09-24T12:00:00+08:00'));
    asRole('member', 'me');
  });

  it('未登入 → 401', async () => {
    harness.user = null;
    expect((await callApi(available)).status).toBe(401);
  });

  it('本週已過截止、還沒開打的場次照樣列出並標 leaveClosed；未截止的可請假', async () => {
    harness.db = db([sess('thu', '2026-09-24'), sess('fri', '2026-09-25'), sess('next', '2026-10-02')]).db;
    const { data } = await callApi(available);
    expect(data.map((s: { id: string; leaveClosed: boolean }) => [s.id, s.leaveClosed])).toEqual([
      ['thu', true],
      ['fri', true],
      ['next', false],
    ]);
  });

  it('已開打的場次不列（今天早上 10:00 那場）', async () => {
    harness.db = db([sess('morning', '2026-09-24', '10:00:00'), sess('fri', '2026-09-25')]).db;
    const { data } = await callApi(available);
    expect(data.map((s: { id: string }) => s.id)).toEqual(['fri']);
  });

  it('我已請假的場次不在請假清單（改列在銷假頁）', async () => {
    harness.db = db([sess('fri', '2026-09-25'), sess('next', '2026-10-02')], ['next']).db;
    const { data } = await callApi(available);
    expect(data.map((s: { id: string }) => s.id)).toEqual(['fri']);
  });

  it('「目前 N 人請假」只算當天在隊者（與後台依場次查一致）', async () => {
    harness.db = fakeDb({
      tables: {
        sessions: ok([sess('next', '2026-10-02')]),
        leave_requests: (q: QueryLog) =>
          q.ops.some((o) => o[0] === 'in')
            ? ok([
                { session_id: 'next', user_id: 'a' },
                { session_id: 'next', user_id: 'gone' }, // 9/28 已被停用
              ])
            : ok([]),
        membership_periods: ok([
          { user_id: 'a', started_on: '2026-09-01', ended_on: null },
          { user_id: 'gone', started_on: '2026-09-01', ended_on: '2026-09-28' },
        ]),
      },
    }).db;
    const { data } = await callApi(available);
    expect(data[0].leaveCount).toBe(1);
  });

  it('請假人數查詢失敗 → 500（不顯示錯的人數）', async () => {
    harness.db = fakeDb({
      tables: {
        sessions: ok([sess('next', '2026-10-02')]),
        leave_requests: (q: QueryLog) => (q.ops.some((o) => o[0] === 'in') ? fail('down') : ok([])),
      },
    }).db;
    expect((await callApi(available)).status).toBe(500);
  });

  it('「我的請假」查詢失敗 → 500（不能當成沒請過，否則已請假的場次又出現）', async () => {
    harness.db = fakeDb({
      tables: {
        sessions: ok([sess('next', '2026-10-02')]),
        leave_requests: (q: QueryLog) => (q.ops.some((o) => o[0] === 'in') ? ok([]) : fail('down')),
      },
    }).db;
    expect((await callApi(available)).status).toBe(500);
  });

  it('本週才臨時加開的場次：截止放寬到開打前 → 可請假（不是已截止）', async () => {
    harness.db = db([
      sess('thu-extra', '2026-09-24', '19:30:00', { kind: 'extra', announced_at: '2026-09-23T02:00:00Z' }),
    ]).db;
    const { data } = await callApi(available);
    expect(data[0].leaveClosed).toBe(false);
    expect(data[0].leaveDeadline).toBe(new Date('2026-09-24T19:30:00+08:00').toISOString());
  });
});

describe('GET /api/stats/mine（我的出席／請假統計）', () => {
  beforeEach(() => vi.setSystemTime(new Date('2026-10-02T12:00:00+08:00')));

  it('未登入 → 401', async () => {
    expect((await callApi(statsMine, { query: { from: '2026-10-01', to: '2026-10-31' } })).status).toBe(401);
  });

  it.each([
    [{}],
    [{ from: '2026-10-01' }],
    [{ from: '2026-13', to: '2026-10-31' }],
    [{ from: '2026-10-31', to: '2026-10-01' }], // 起日晚於迄日
  ])('參數錯誤 → 400，不查資料庫（%j）', async (query) => {
    asRole('member');
    const f = fakeDb();
    harness.db = f.db;
    expect((await callApi(statsMine, { query })).status).toBe(400);
    expect(f.log.queries).toHaveLength(0);
  });

  it('只查登入者自己的在隊期間與請假', async () => {
    asRole('member', 'me');
    const f = fakeDb({ tables: { membership_periods: ok([]), sessions: ok([]) } });
    harness.db = f.db;
    const r = await callApi(statsMine, { query: { from: '2026-10-01', to: '2026-10-31' } });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ sessionsCount: 0, attendCount: 0, upcomingLeaveCount: 0 });
    expect(hasOp(f.log.queries.find((q) => q.table === 'membership_periods')!, ['eq', 'user_id', 'me'])).toBe(true);
  });

  it('查詢失敗 → 500', async () => {
    asRole('member');
    harness.db = fakeDb({ tables: { membership_periods: fail('down') } }).db;
    expect((await callApi(statsMine, { query: { from: '2026-10-01', to: '2026-10-31' } })).status).toBe(500);
  });
});

describe('GET /api/me/notices（請假場次異動的未讀通知）', () => {
  const notice = (id: string, sessionDate: string, startTime = '19:30:00') => ({
    id,
    old_date: '2026-10-02',
    old_start: '19:30:00',
    old_end: '22:00:00',
    new_date: sessionDate,
    new_start: startTime,
    new_end: '22:00:00',
    leave_requests: { status: 'active' },
    sessions: { session_date: sessionDate, start_time: startTime, is_cancelled: false },
  });
  beforeEach(() => vi.setSystemTime(new Date('2026-09-24T12:00:00+08:00')));

  it('未登入 → 401', async () => {
    expect((await callApi(noticesGet)).status).toBe(401);
  });

  it('只查「我的、未讀、請假仍有效、場次未取消」的通知', async () => {
    asRole('member', 'me');
    const f = fakeDb({ tables: { leave_change_notices: ok([]) } });
    harness.db = f.db;
    await callApi(noticesGet);
    const q = f.log.queries[0]!;
    expect(hasOp(q, ['eq', 'user_id', 'me'])).toBe(true);
    expect(hasOp(q, ['is', 'acknowledged_at', null])).toBe(true);
    expect(hasOp(q, ['eq', 'leave_requests.status', 'active'])).toBe(true);
    expect(hasOp(q, ['eq', 'sessions.is_cancelled', false])).toBe(true);
  });

  it('回傳「原 → 新」；已開打的場次不再提醒', async () => {
    asRole('member', 'me');
    harness.db = fakeDb({
      tables: {
        leave_change_notices: ok([notice('n1', '2026-10-03'), notice('n-past', '2026-09-24', '10:00:00')]),
      },
    }).db;
    expect((await callApi(noticesGet)).data).toEqual([
      {
        id: 'n1',
        from: { date: '2026-10-02', start: '19:30:00', end: '22:00:00' },
        to: { date: '2026-10-03', start: '19:30:00', end: '22:00:00' },
      },
    ]);
  });

  it('查詢失敗 → 500', async () => {
    asRole('member');
    harness.db = fakeDb({ tables: { leave_change_notices: fail('down') } }).db;
    expect((await callApi(noticesGet)).status).toBe(500);
  });
});

describe('POST /api/me/notices（標記已讀）', () => {
  it('未登入 → 401', async () => {
    expect((await callApi(noticesPost, { body: { ids: [S1] } })).status).toBe(401);
  });

  it.each([
    [{}],
    [{ ids: [] }],
    [{ ids: S1 }],
    [{ ids: [1, 2] }],
    [{ ids: Array(51).fill(S1) }],
    [{ ids: ['not-a-uuid'] }], // 非 uuid 丟進查詢會讓 Postgres 回 22P02 變 500
    [{ ids: [S1, "x' or 1=1"] }], // 混入一個非 uuid 也整批擋
  ])('ids 格式錯誤 → 400（%j）', async (body) => {
    asRole('member');
    const f = fakeDb();
    harness.db = f.db;
    expect((await callApi(noticesPost, { body })).status).toBe(400);
    expect(f.log.queries).toHaveLength(0);
  });

  it('只能標自己的未讀通知', async () => {
    asRole('member', 'me');
    const f = fakeDb({ tables: { leave_change_notices: ok(null) } });
    harness.db = f.db;
    expect(await callApi(noticesPost, { body: { ids: [S1, S2] } })).toEqual({ status: 200, data: { ok: true } });
    const q = f.log.queries[0]!;
    expect(q.ops[0]![0]).toBe('update');
    expect(hasOp(q, ['eq', 'user_id', 'me'])).toBe(true);
    expect(hasOp(q, ['in', 'id', [S1, S2]])).toBe(true);
    expect(hasOp(q, ['is', 'acknowledged_at', null])).toBe(true);
  });
});
