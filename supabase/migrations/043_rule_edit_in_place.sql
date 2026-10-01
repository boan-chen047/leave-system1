-- 043_rule_edit_in_place.sql —— 編輯規則改為「就地更新」未來場次，已請假的場次也一起改
-- 委託人 2026-09-24：原本編輯規則＝刪掉「生效日起、沒有任何請假紀錄」的場次再重生成，
-- 有請假紀錄（含已銷假）的場次會被跳過而停在舊時間/地點 → 要出席的人看到舊時間、跑錯。
-- 另外重生成的場次 announced_at＝now()，週三改規則會讓本週場次的請假截止被意外放寬。
--
-- 改為：生效日（且不早於今天，台北）起、屬於這條規則的場次一律「就地 UPDATE」：
--   · 時間、地點、備註直接套用新規則；請假紀錄留在原場次上（session id 不變）
--   · 改星期幾：同一週內（週一～週日）平移到新的星期幾；平移後若早於生效日/今天，
--     那場維持原日期（下週才開始用新星期幾），避免場次被搬到過去
--   · 含已取消的場次一起平移（保持「那週已取消」的狀態，generate 不會在新日期補回）
--   · rule_skips（因單場改期而略過的日期）同步平移，避免新星期幾在那週多長出一場
-- 之後照舊：清超出週數的遠期場次 → generate_sessions 補齊缺的日期。

-- ── announced_at 改由 trigger 維護：日期或開始時間變動就更新 ─────────────
-- 單場改期（reschedule_session）與改規則（就地更新）都會經過這裡，不必各寫一次。
create or replace function touch_session_announced_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if NEW.session_date is distinct from OLD.session_date
     or NEW.start_time is distinct from OLD.start_time then
    NEW.announced_at := now();
  end if;
  return NEW;
end $$;

drop trigger if exists sessions_touch_announced_at on sessions;
create trigger sessions_touch_announced_at
  before update of session_date, start_time on sessions
  for each row execute function touch_session_announced_at();

-- reschedule_session：announced_at 交給 trigger，移除函式內的手動設定（其餘同 042）
create or replace function reschedule_session(
  p_id uuid, p_date date, p_start time, p_end time, p_location text, p_description text, p_actor uuid
) returns void language plpgsql set search_path = public as $$
declare cur record; v_detail text;
begin
  select source_rule_id, session_date, start_time, end_time, location into cur
    from sessions where id = p_id for update;
  if not found then raise exception '找不到場次' using errcode = 'P0002'; end if;

  v_detail := session_label(cur.session_date, cur.start_time, cur.end_time, cur.location)
              || ' → ' || session_label(p_date, p_start, p_end, p_location);

  -- 固定場次改期：把原日期登記為 rule_skips 並脫離規則（避免規則再長回原日期）
  if cur.source_rule_id is not null and p_date <> cur.session_date then
    insert into rule_skips (source_rule_id, session_date)
    values (cur.source_rule_id, cur.session_date)
    on conflict (source_rule_id, session_date) do nothing;
  end if;

  update sessions set
    session_date = p_date,
    start_time = p_start,
    end_time = p_end,
    location = p_location,
    description = p_description,
    source_rule_id = case
      when cur.source_rule_id is not null and p_date <> cur.session_date then null
      else source_rule_id
    end
  where id = p_id;

  perform log_session_action(p_id, 'session_reschedule', p_actor, v_detail);
end $$;

-- ── edit_rule_with_weeks：就地更新 ─────────────────────────────────
create or replace function edit_rule_with_weeks(
  p_rule_id uuid, p_weeks integer, p_weekday integer, p_start_time time, p_end_time time,
  p_location text, p_effective_from date, p_description text
) returns integer language plpgsql set search_path = public as $$
declare
  v_old_weekday int;
  v_shift int;
  -- 只動「生效日起、且不早於今天（台北）」的場次；之前的場次不動
  v_floor date := greatest((now() at time zone 'Asia/Taipei')::date, p_effective_from);
begin
  select weekday into v_old_weekday from recurring_rules where id = p_rule_id for update;
  if not found then raise exception '找不到規則 %', p_rule_id using errcode = 'no_data_found'; end if;

  update app_config set generate_weeks_ahead = p_weeks, updated_at = now() where id;
  update recurring_rules set
    weekday = p_weekday, start_time = p_start_time, end_time = p_end_time,
    location = p_location, effective_from = p_effective_from, description = p_description, updated_at = now()
  where id = p_rule_id;

  -- 同一週（週一～週日）內的平移天數。dow：0=日..6=六 → 換成 週一=1..週日=7 再相減
  v_shift := (case when p_weekday = 0 then 7 else p_weekday end)
           - (case when v_old_weekday = 0 then 7 else v_old_weekday end);

  -- 就地更新（含已請假、已取消的場次）。|v_shift| <= 6 且新舊星期幾不同，
  -- 平移後的日期不會撞到同規則其他場次（唯一索引 source_rule_id＋session_date）。
  update sessions s set
    session_date = case
      when v_shift <> 0 and s.session_date + v_shift >= v_floor then s.session_date + v_shift
      else s.session_date
    end,
    start_time = p_start_time,
    end_time = p_end_time,
    location = p_location,
    description = p_description
  where s.source_rule_id = p_rule_id and s.session_date >= v_floor;

  if v_shift <> 0 then
    update rule_skips k set session_date = k.session_date + v_shift
    where k.source_rule_id = p_rule_id
      and k.session_date >= v_floor and k.session_date + v_shift >= v_floor;
  end if;

  perform purge_sessions_beyond_horizon(p_weeks);
  return generate_sessions();
end $$;
