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
  leaveDeadline?: string; // 請假/銷假截止時刻（ISO），見 utils/date.effectiveLeaveDeadline
  leaveClosed?: boolean; // 已過截止但還沒開打：照樣列出讓成員看得到，按鈕反灰「已截止」
  leaveCount?: number; // 這場目前已請假人數（資料揭露；未提供則不顯示）
};

export type LeaveRow = {
  id: string;
  session: SessionRow;
  createdAt: string;
};
