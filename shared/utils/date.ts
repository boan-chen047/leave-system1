//
// 前後端共用（shared/）：畫面顯示的截止時間，和後端判斷「能不能請假」用的是同一份規則。
//
// 整個系統在台灣運作，但伺服器（Vercel）與 CI 都跑 UTC。若用 Date 的
// local 方法（getFullYear/getMonth/getDate），日期會在環境時區不是 +08 時飄掉。
// 因此所有「把時刻換算成日曆日」的動作，一律明確指定 Asia/Taipei。
const TZ = 'Asia/Taipei';
const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'] as const;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 把一個絕對時刻格式成台灣日曆日 'YYYY-MM-DD'（與伺服器/CI 時區無關） */
function taipeiISODate(d: Date): string {
  // en-CA 的 date 格式恰好是 'YYYY-MM-DD'
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * 'YYYY-MM-DD' → [年, 月, 日]（數字，月 1-based）。
 * Nuxt 的 TypeScript 設定較嚴（noUncheckedIndexedAccess），陣列取值會被當成可能不存在；
 * 用預設值 NaN 滿足型別。輸入一律是 ISO 日期字串，正常不會用到預設值。
 */
function ymd(iso: string): [number, number, number] {
  const [y = NaN, m = NaN, d = NaN] = iso.split('-').map(Number);
  return [y, m, d];
}

/** 台灣日曆的 {年, 月}（1-based 月），供 range 計算 */
function taipeiYM(d: Date): { y: number; m: number } {
  const [y, m] = ymd(taipeiISODate(d));
  return { y, m };
}

/** '2026-09-08' → '2026/09/08（二）' */
export function formatSessionDate(iso: string): string {
  const [y, m, d] = ymd(iso);
  // 用 UTC 建構避開時區位移：純日曆日，不涉及當地時間語意
  const weekday = WEEKDAY_ZH[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}/${pad(m)}/${pad(d)}（${weekday}）`;
}

/** Postgres 的 time 型別會帶秒數，顯示時砍掉 */
export function formatTimeRange(start: string, end: string): string {
  const hhmm = (t: string) => t.slice(0, 5);
  return `${hhmm(start)}–${hhmm(end)}`;
}

/**
 * 台灣「本月」的月份數字（1～12），供「N 月出席」這類標籤用。
 * 不可用 new Date().getMonth()：那是裝置本地時區，人在國外或跨月那一刻會跟
 * rangeThisMonth()（台北）算出的統計數字對不上。
 */
export function taipeiMonth(today = new Date()): number {
  return taipeiYM(today).m;
}

/**
 * 台灣「整個本月」：1 日到月底（不是到今天）。首頁「N 月已請假」要把本月還沒打的場次
 * 的請假也算進來，所以區間要涵蓋到月底；出席仍只算已結束場次，不受影響。
 */
export function rangeWholeMonth(today = new Date()): { from: string; to: string } {
  const { y, m } = taipeiYM(today);
  // Date.UTC 的「下個月第 0 天」＝本月最後一天，閏年 2 月自動正確
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
}

export function rangeThisMonth(today = new Date()): { from: string; to: string } {
  const { y, m } = taipeiYM(today);
  return { from: `${y}-${pad(m)}-01`, to: taipeiISODate(today) };
}

/** 今天往前推三個完整月的 1 日（今天 9/7 → 6/1 至 9/7） */
export function rangeLastThreeMonths(today = new Date()): { from: string; to: string } {
  const { y, m } = taipeiYM(today);
  // 月份 1-based 做退三個月的跨年換算
  const zeroBased = y * 12 + (m - 1) - 3;
  const fy = Math.floor(zeroBased / 12);
  const fm = (zeroBased % 12) + 1;
  return { from: `${fy}-${pad(fm)}-01`, to: taipeiISODate(today) };
}

export function rangeThisYear(today = new Date()): { from: string; to: string } {
  const { y } = taipeiYM(today);
  return { from: `${y}-01-01`, to: taipeiISODate(today) };
}

/** 本季區間（台灣）：季首月 1 日 → 今天。季首月＝1/4/7/10。 */
export function rangeThisQuarter(today = new Date()): { from: string; to: string } {
  const { y, m } = taipeiYM(today);
  const qStartMonth = Math.floor((m - 1) / 3) * 3 + 1; // 1,4,7,10
  return { from: `${y}-${pad(qStartMonth)}-01`, to: taipeiISODate(today) };
}

/** 台灣「今天」的日曆日 'YYYY-MM-DD'（與伺服器時區無關） */
export function taipeiToday(now = new Date()): string {
  return taipeiISODate(now);
}

/** 台灣「明天」的日曆日 'YYYY-MM-DD'（台灣固定 +08、無日光節約，直接加 24h 再取台北日）。 */
export function taipeiTomorrow(now = new Date()): string {
  return taipeiISODate(new Date(now.getTime() + 24 * 60 * 60 * 1000));
}

/** 把絕對時刻（ISO/timestamptz）格式成台北「YYYY-MM-DD HH:mm:ss」（操作 log 用）。 */
export function taipeiDateTime(iso: string): string {
  // en-CA 給 'YYYY-MM-DD, HH:MM:SS'（hour12:false ＝ 24 小時制），把逗號去掉
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(new Date(iso))
    .replace(',', '');
}

/**
 * 以台灣時間論，場次是否已到「開打時刻」。請假／銷假一旦開打就不該再允許。
 *
 * 台灣固定 UTC+8、無日光節約，所以把「場次日期 + 開始時間」直接標成 +08:00
 * 即得到那一刻的絕對時間，再與 now 的絕對時間比較——兩邊都是絕對時刻，
 * 比較結果與伺服器時區無關，也精確到分，不會像「只比日期」那樣在
 * 場次已結束的當晚仍判成還沒開打。
 */
export function sessionHasStarted(
  sessionDate: string,
  startTime: string,
  now = new Date(),
): boolean {
  const hhmmss = startTime.length === 5 ? `${startTime}:00` : startTime;
  const startInstant = new Date(`${sessionDate}T${hhmmss}+08:00`);
  return startInstant.getTime() <= now.getTime();
}

/**
 * 以台灣時間論，場次是否已結束（過了結束時刻）。管理員手動銷假只允許在「活動結束前」。
 * 台灣固定 +08:00、無日光節約，把「場次日期＋結束時間」標成 +08:00 即得絕對時刻。
 */
export function sessionHasEnded(sessionDate: string, endTime: string, now = new Date()): boolean {
  const hhmmss = endTime.length === 5 ? `${endTime}:00` : endTime;
  return new Date(`${sessionDate}T${hhmmss}+08:00`).getTime() <= now.getTime();
}

/**
 * 請假／銷假截止時刻：早於場次開打、最近的那個「星期二 23:59（台北）」。
 * 週三～週日的場次 → 該週星期二 23:59；週一、週二的場次 → 上週星期二 23:59
 * （場次當天或之後的星期二 23:59 會晚於開打，所以往前抓一週）。台灣無日光節約，固定 +08:00。
 */
export function leaveDeadline(sessionDate: string, startTime: string): Date {
  const [y, m, d] = ymd(sessionDate);
  // 以日曆日算星期幾（與時區無關）：0=日..6=六，星期二=2
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  let daysBack = (dow - 2 + 7) % 7; // 往回幾天到最近的星期二（場次就在週二時為 0）
  if (daysBack === 0) daysBack = 7; // 週二的場次：同日 23:59 晚於開打，改抓上週二
  const tue = new Date(Date.UTC(y, m - 1, d - daysBack)).toISOString().slice(0, 10);
  return new Date(`${tue}T23:59:00+08:00`);
}

/**
 * 是否已過「基本規則」的週二截止（見 leaveDeadline）。
 * ⚠️ 路由判斷請假/銷假是否允許時，請用 pastEffectiveLeaveDeadline（含臨時公告場次的放寬）。
 */
export function pastLeaveDeadline(sessionDate: string, startTime: string, now = new Date()): boolean {
  return now.getTime() >= leaveDeadline(sessionDate, startTime).getTime();
}

/** 場次開打的絕對時刻（台灣固定 +08:00） */
function sessionStartInstant(sessionDate: string, startTime: string): Date {
  const hhmmss = startTime.length === 5 ? `${startTime}:00` : startTime;
  return new Date(`${sessionDate}T${hhmmss}+08:00`);
}

/**
 * 實際的請假／銷假截止（委託人 2026-09-24，migration 042）。
 * 預設＝週二 23:59（leaveDeadline）。但若場次「公告時間」（sessions.announced_at：新增時間，
 * 改期到新日期/時間時更新）已晚於那個週二截止——例如週三才加開週四的場、或改期到本週——
 * 建立當下就已截止，成員會永遠無法線上請假、首頁也看不到。此時截止放寬到「開打前」。
 * announcedAt 未提供時沿用週二規則。
 */
export function effectiveLeaveDeadline(
  sessionDate: string,
  startTime: string,
  announcedAt?: string | null,
): Date {
  const tue = leaveDeadline(sessionDate, startTime);
  if (announcedAt && new Date(announcedAt).getTime() >= tue.getTime()) {
    return sessionStartInstant(sessionDate, startTime);
  }
  return tue;
}

/** 是否已過實際的請假／銷假截止（見 effectiveLeaveDeadline）。路由一律用這個判斷。 */
export function pastEffectiveLeaveDeadline(
  sessionDate: string,
  startTime: string,
  announcedAt?: string | null,
  now = new Date(),
): boolean {
  return now.getTime() >= effectiveLeaveDeadline(sessionDate, startTime, announcedAt).getTime();
}

/** 把截止時刻（ISO）格式化成台北顯示，如「9/15（週二）23:59」 */
export function formatDeadline(iso: string): string {
  const d = new Date(iso);
  const f = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', ...opts }).format(d);
  return `${f({ month: 'numeric', day: 'numeric' })}（${f({ weekday: 'short' })}）${f({
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })}`;
}
