-- 042_session_announced_at.sql —— 場次「公告時間」：臨時加開／改期到本週的場次也能線上請假
-- 委託人 2026-09-24：請假截止＝「開打前最近的週二 23:59」。但若場次在那個週二之後才出現
-- （週三加開週四的場、或把場次改期到本週），建立當下截止就已過 → 成員永遠不能線上請假，
-- 首頁也看不到。改為：場次公告時間若已晚於週二截止，截止放寬到「開打前」（TS 端
-- effectiveLeaveDeadline）；其餘場次維持週二 23:59 不變。
--
-- announced_at：新增時 = now()（後台加開、generate_sessions 都靠預設值）；
--               改期到不同日期或開始時間時，reschedule_session 會更新為 now()。
-- 既有場次回填為 created_at → 現有場次的截止時間一個都不會變。

alter table sessions add column if not exists announced_at timestamptz;
update sessions set announced_at = created_at where announced_at is null;
alter table sessions alter column announced_at set default now();
alter table sessions alter column announced_at set not null;

-- 改期：日期或開始時間有變才更新 announced_at（只改地點/備註不影響截止）
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
    end,
    announced_at = case
      when p_date <> cur.session_date or p_start <> cur.start_time then now()
      else announced_at
    end
  where id = p_id;

  perform log_session_action(p_id, 'session_reschedule', p_actor, v_detail);
end $$;
