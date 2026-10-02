// 前後端共用的資料型別，由原 Next.js 版 src/lib/types.ts 搬來。

/** 場次卡右上角的狀態徽章：已請假／加開／出席／已結束 */
export type BadgeStatus = 'leave' | 'extra' | 'attend' | 'ended';

/** 角色：一般成員／二級管理員／一級管理員 */
export type AppRole = 'member' | 'admin2' | 'admin1';

export type Me = {
  id: string;
  displayName: string; // LINE 名稱，每次登入覆寫
  pictureUrl: string | null;
  realName: string | null; // 自己填的名字（可填綽號）；null 代表尚未確認（首次設定）
  role: AppRole;
  isActive: boolean; // false＝已停用（自助停用者可重登重啟）
  termsVersion: string | null; // 已同意的條款版本；不等於現行版本即需（重新）同意
  // 退費途徑（首次設定第三關）；兩者皆 false 代表尚未設定
  refundLinePay: boolean;
  refundBank: boolean;
  bankCode: string | null;
  bankAccount: string | null;
};

export type SessionRow = {
  id: string;
  sessionDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM:SS
  endTime: string;
  location: string;
  kind: 'regular' | 'extra';
  description?: string | null; // 場次敘述（可空）
  leaveDeadline?: string; // 請假/銷假截止時刻（ISO），見 shared/utils/date.effectiveLeaveDeadline
  leaveClosed?: boolean; // 已過截止但還沒開打：照樣列出讓成員看得到，按鈕反灰「已截止」
  leaveCount?: number; // 這場目前已請假人數（資料揭露；未提供則不顯示）
};

export type LeaveRow = {
  id: string;
  session: SessionRow;
  createdAt: string;
};

/** 某段期間的出席／請假統計（GET /api/stats/mine；算法見 server/utils/memberStats.ts） */
export type MemberStats = {
  sessionsCount: number; // 應出席：區間內、在隊、未取消、已結束的場次
  leaveCount: number; // 上面那些場次中有請假的
  attendCount: number; // 出席＝應出席－請假
  // 區間內「已請假、但場次還沒結束」的請假數（不計入出席／請假統計）。
  // 首頁「N 月已請假」＝leaveCount＋upcomingLeaveCount，成員才看得到剛送出的假
  upcomingLeaveCount: number;
  leaves: {
    id: string;
    createdAt: string;
    session: Pick<SessionRow, 'id' | 'sessionDate' | 'startTime' | 'endTime' | 'location' | 'kind'>;
  }[];
  appliedFrom: string; // 實際套用的起日（可能被兩年下限往後推）
  appliedTo: string;
  truncated: boolean; // 區間被調整過（兩年下限、或有場次因不在隊而排除），畫面要提示
};

/** 場次的一個時段（日期＋起訖時間） */
export type SessionSlot = { date: string; start: string; end: string };

/** 「你請假的場次有異動」通知：原時段 → 新時段（GET /api/me/notices） */
export type LeaveChangeNotice = { id: string; from: SessionSlot; to: SessionSlot };
