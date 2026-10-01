# 請假系統（Nuxt 版）

球團場次請假／銷假系統，以 LINE LIFF 提供。這個 repo 是把原本的 **Next.js（React）版**（`leave-system`）改寫成 **Nuxt（Vue）版**，依「初始介面 → 登入系統 → 功能介面」分步搬移，每一步一個分支、做完合併回 `main`。

## 改寫進度

| 步驟 | 內容 | 分支 | 狀態 |
|---|---|---|---|
| 1 | 初始介面：專案骨架、配色、版面、底部分頁列、共用元件、四個成員頁骨架、元件預覽頁 | `feat/step1-initial-ui` | ✅ |
| 2 | 登入系統：LINE LIFF 登入、session、`/api/me`、首次設定三關（暱稱／條款／退費途徑） | | ⏳ |
| 3 | 請假頁：場次列表、請假、已截止反灰、目前 N 人請假 | | ⏳ |
| 4 | 銷假頁 | | ⏳ |
| 5 | 紀錄頁 | | ⏳ |
| 6 | 個人頁：改暱稱、退費途徑、停用／刪除帳號 | | ⏳ |
| 7～ | 後台各頁（依場次查、依個人查、統計、代填請假、退費、場次管理、成員、查詢退款途徑） | | ⏳ |

尚未接上的頁面會顯示「尚未接上（第 N 步）」提示，不放假資料。

## 技術棧

- **Nuxt 4**（Vue 3 + TypeScript），只在瀏覽器端渲染（`ssr: false`：LIFF 只能在瀏覽器跑）
- **套件管理**：pnpm
- **圖示**：`@lucide/vue`
- **測試**：Vitest + @vue/test-utils + happy-dom

## 本機開發

```bash
pnpm install
pnpm dev            # http://localhost:3000（加 --port 3001 可換 port）
pnpm test           # 單元／元件測試
pnpm typecheck      # 型別檢查（vue-tsc）
pnpm build          # 正式建置
```

開發時可開 `/ui-preview` 看所有共用元件（示範資料）。

## 從 Next.js 版對應過來

| Next.js 版 | Nuxt 版 | 差異 |
|---|---|---|
| `src/app/globals.css` | `app/assets/css/main.css` | 內容相同 |
| `src/app/layout.tsx` | `app/app.vue`＋`app/layouts/default.vue` | 外框＋分頁列寫在 layout，頁面不用各自包 |
| `src/components/ui/*.tsx` | `app/components/ui/*.vue` | 用 `<UiButton>`、`<UiBadge>`… 使用（Nuxt 依資料夾自動加前綴） |
| `TabBar` 傳 `active` | `TabBar` 讀網址判斷 | 頁面不用再傳目前分頁 |
| `useMe()`（React Context） | `useMe()`（Nuxt `useState`） | 第 2 步接上登入 |
| `src/lib/date.ts` | `app/utils/date.ts` | 原樣搬移，原專案 30 個測試照搬並通過 |

## 開發注意

- **`<template>` 最外層不要在根元素旁放 HTML 註解**：Vue 開發模式會把它當成多個根節點，外部傳入的 `@click`、`style` 會失效（按鈕點了沒反應）。註解寫在 `<script>` 裡或 `<template>` 外面。
- 被元件測試的元件要自己 `import` 用到的東西（`vue`、`~/utils/...`），不要只靠 Nuxt 自動匯入，否則單獨測試時找不到。
- TypeScript 刻意用 5.x：vue-tsc 尚未支援 TypeScript 7。
