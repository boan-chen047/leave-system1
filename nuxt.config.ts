// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // 只在瀏覽器端渲染（SPA）：LINE LIFF 登入只能在瀏覽器跑、每頁資料都要登入後才有，
  // 也不需要搜尋引擎收錄。原 Next.js 版的頁面也全是 'use client'，行為一致。
  // 後端 API（server/ 目錄）不受影響，照常在伺服器執行。
  ssr: false,

  // 執行設定：值由環境變數覆蓋（NUXT_ 開頭、駝峰轉大寫底線，見 .env.example 與 docs/部署與設定.md）。
  // 頂層的只在伺服器端讀得到（金鑰放這裡）；public 底下的會送到瀏覽器（只能放可公開的值）。
  runtimeConfig: {
    supabaseUrl: '', // NUXT_SUPABASE_URL
    supabaseServiceRoleKey: '', // NUXT_SUPABASE_SERVICE_ROLE_KEY（繞過 RLS，絕不可公開）
    sessionSecret: '', // NUXT_SESSION_SECRET（簽登入憑證，至少 32 字元）
    lineChannelId: '', // NUXT_LINE_CHANNEL_ID（驗證 LINE idToken 的 aud）
    devLogin: '', // NUXT_DEV_LOGIN=1 才開本機測試登入（正式建置一律關閉）
    public: {
      liffId: '', // NUXT_PUBLIC_LIFF_ID
      devLogin: '', // NUXT_PUBLIC_DEV_LOGIN=1：前端顯示測試登入畫面（同樣只在開發模式有效）
    },
  },

  // 元件自動匯入：ui/ 底下加前綴（<UiButton>）；dialogs/ 底下不加（<NameDialog>，名稱本身已含 Dialog）
  components: [{ path: '~/components/dialogs', pathPrefix: false }, '~/components'],

  // 全站配色與版面設定（排球主題：藍/金/杏白），由原 Next.js 版 globals.css 搬來
  css: ['~/assets/css/main.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'zh-Hant' },
      title: '請假系統',
      meta: [
        { name: 'description', content: '球團場次請假／銷假' },
        // LINE 內建瀏覽器有上方標題列，viewport-fit=cover 讓內容用滿可視高度
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      ],
    },
  },
});
