# 請假系統（Nuxt 版）

球團場次請假／銷假系統，以 LINE LIFF 提供。這個 repo 是把原本的 **Next.js（React）版**（`leave-system`）改寫成 **Nuxt（Vue）版**，依「初始介面 → 登入系統 → 功能介面」分步搬移，每一步一個分支、做完合併回 `main`。

## 改寫進度

| 步驟 | 內容 | 分支 | 狀態 |
|---|---|---|---|
| 1 | 初始介面：專案骨架、配色、版面、底部分頁列、共用元件、四個成員頁骨架、元件預覽頁 | `feat/step1-initial-ui` | ✅ |
| 2 | 登入系統：LINE LIFF 登入、登入憑證、`/api/me` 系列、首次設定三關、停用／重新啟用、隱私權頁、開發用測試登入 | `feat/step2-login` | ✅ |
| 3 | 請假頁：場次列表、請假、已截止反灰、目前 N 人請假、本月統計、請假場次異動通知 | `feat/step3-leave` | ✅ |
| 4 | 銷假頁 | | ⏳ |
| 5 | 紀錄頁 | | ⏳ |
| 6 | 個人頁：改名字、退費途徑、停用／刪除帳號 | | ⏳ |
| 7～ | 後台各頁（依場次查、依個人查、統計、代填請假、退費、場次管理、成員、查詢退款途徑） | | ⏳ |

尚未接上的頁面會顯示「尚未接上（第 N 步）」提示，不放假資料。

正式網址：https://leave-system1-fawn.vercel.app（推到 `main` 自動部署）

## 技術棧

- **Nuxt 4**（Vue 3 + TypeScript），只在瀏覽器端渲染（`ssr: false`）；後端 API 用 Nuxt 內建的 Nitro
- **資料庫**：Supabase（PostgreSQL），Nuxt 版專用的獨立專案
- **登入**：LINE LIFF＋本站自簽的 30 天登入憑證（jose）
- **套件管理**：pnpm｜**圖示**：`@lucide/vue`｜**測試**：Vitest＋@vue/test-utils＋happy-dom

## 快速開始

```bash
pnpm install
cp .env.example .env   # 填入金鑰，見 docs/部署與設定.md
pnpm dev               # http://localhost:3000；本機用「開發用測試登入」
pnpm test && pnpm typecheck && pnpm build   # 上線前三項都要過
```

## 文件

- [架構與模組](docs/架構與模組.md)：目錄結構、各模組怎麼運作、共用寫法、開發注意事項、與 Next.js 版的對照
- [請假頁](docs/請假頁.md)：哪些場次會列出、請假截止規則、請假人數與統計怎麼算、異動通知、API 參數
- [登入系統](docs/登入系統.md)：登入流程、首次設定、登入憑證、測試登入的安全設計、API 參數與回應
- [部署與設定](docs/部署與設定.md)：環境變數、建置、Supabase／LINE LIFF／Vercel 設定步驟
- [資料表 migrations](supabase/migrations/README.md)
- 業務規則（請假截止、出席計算、退費等）沿用 Next.js 版 `leave-system/docs/spec.md`
