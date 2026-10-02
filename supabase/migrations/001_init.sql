-- 001_init.sql —— 資料表、列舉型別、索引、約束
-- 對應 docs/spec.md §3

-- ── 列舉型別 ────────────────────────────────────────────────
create type user_role    as enum ('member', 'admin2', 'admin1');
create type session_kind as enum ('regular', 'extra');   -- regular=固定場次, extra=加開
create type leave_status as enum ('active', 'cancelled');
create type period_type  as enum ('month', 'quarter', 'year');

-- ── 使用者 ──────────────────────────────────────────────────
create table users (
  id           uuid primary key default gen_random_uuid(),
  line_user_id text        not null unique,
  display_name text        not null,          -- LINE 暱稱，每次登入自動覆寫
  picture_url  text,                          -- LINE 大頭貼 URL，每次登入自動覆寫
  real_name    text,                          -- null = 尚未完成首次設定，前端強制跳填名框
  role         user_role   not null default 'member',
  is_active    boolean     not null default true,
  -- 停用的「時間點」必須記下來，不能只有 is_active 布林值。
  -- 沒有這欄的話，月底退出的人在跑上月月結時會整個從報表消失，
  -- 但他上月有繳費、有請假、需要退費。見 §6.2。
  deactivated_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint deactivated_matches_flag
    check ((is_active = false) = (deactivated_at is not null))
);

-- ── 固定場次規則 ────────────────────────────────────────────
-- 目前只會有一筆（每週二），但設計成多筆，之後要加週四不用改結構
create table recurring_rules (
  id         uuid primary key default gen_random_uuid(),
  weekday    smallint not null check (weekday between 0 and 6),  -- 0=週日 … 2=週二 … 6=週六
  start_time time     not null,
  end_time   time     not null,
  location   text     not null,
  is_active  boolean  not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rule_time_order check (end_time > start_time)
);

-- ── 場次 ────────────────────────────────────────────────────
create table sessions (
  id             uuid primary key default gen_random_uuid(),
  session_date   date         not null,
  start_time     time         not null,
  end_time       time         not null,
  location       text         not null,
  kind           session_kind not null default 'regular',
  source_rule_id uuid references recurring_rules(id) on delete set null,
  created_by     uuid references users(id) on delete set null,
  is_cancelled   boolean      not null default false,
  note           text,
  created_at     timestamptz  not null default now(),
  constraint session_time_order check (end_time > start_time)
);

-- 防止排程重複生成同一條規則在同一天的場次（排程可安全重跑）
create unique index sessions_rule_date_uniq
  on sessions (source_rule_id, session_date)
  where source_rule_id is not null;

create index sessions_date_idx on sessions (session_date);

-- ── 請假單 ──────────────────────────────────────────────────
-- 銷假不刪除，只把 status 改成 cancelled，保留「請了又銷」的軌跡
create table leave_requests (
  id           uuid         primary key default gen_random_uuid(),
  session_id   uuid         not null references sessions(id) on delete cascade,
  user_id      uuid         not null references users(id)    on delete cascade,
  status       leave_status not null default 'active',
  created_at   timestamptz  not null default now(),
  cancelled_at timestamptz,
  constraint cancelled_has_timestamp
    check ((status = 'cancelled') = (cancelled_at is not null))
);

-- 同一人對同一場次只能有一筆有效請假；已銷假的不算，所以可以重複請
create unique index leave_requests_active_uniq
  on leave_requests (session_id, user_id)
  where status = 'active';

create index leave_requests_user_idx    on leave_requests (user_id);
create index leave_requests_session_idx on leave_requests (session_id);

-- ── 結算快照（月／季／年）─────────────────────────────────────
-- 由排程產生。存快照而非每次即時算，理由見 §6.2
create table attendance_summaries (
  id             uuid        primary key default gen_random_uuid(),
  period_type    period_type not null,
  period_key     text        not null,   -- '2026-09' | '2026-Q3' | '2026'
  period_start   date        not null,
  period_end     date        not null,
  user_id        uuid        not null references users(id) on delete cascade,
  real_name      text        not null,   -- 產生當下的姓名快照，人改名後歷史報表仍讀得懂
  sessions_count int         not null,   -- 有效成員期間內、未取消的場次數
  leave_count    int         not null,   -- 該員有效請假數
  attend_count   int         not null,   -- sessions_count - leave_count
  generated_at   timestamptz not null default now(),
  unique (period_type, period_key, user_id)
);

create index summaries_lookup_idx on attendance_summaries (period_type, period_key);

-- ── 年報封存紀錄 ────────────────────────────────────────────
-- 只有年報會產生實體檔案；保留 5 年，超過的連同 Storage 檔案一起刪
create table archive_exports (
  id            uuid        primary key default gen_random_uuid(),
  period_key    text        not null unique,   -- '2026'
  storage_path  text        not null,          -- archives/summary-2026.csv
  drive_file_id text,                          -- Google Drive 檔案 ID（未啟用為 null）
  drive_url     text,
  drive_error   text,                          -- Drive 上傳失敗原因；不影響 Storage 那份
  row_count     int         not null,
  created_at    timestamptz not null default now()
);
