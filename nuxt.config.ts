// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // 只在瀏覽器端渲染（SPA）：LINE LIFF 登入只能在瀏覽器跑、每頁資料都要登入後才有，
  // 也不需要搜尋引擎收錄。原 Next.js 版的頁面也全是 'use client'，行為一致。
  // 後端 API（server/ 目錄）不受影響，照常在伺服器執行。
  ssr: false,

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
