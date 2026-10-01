import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

// 單元／元件測試：直接用 Vue 外掛＋happy-dom（模擬瀏覽器 DOM），不啟動整個 Nuxt。
// 所以被測元件要自己 import 用到的東西（vue、~/utils），不依賴 Nuxt 的自動匯入。
export default defineConfig({
  plugins: [vue()],
  resolve: {
    // 與 Nuxt 相同的路徑別名：~ 指向 app/
    alias: { '~': fileURLToPath(new URL('./app', import.meta.url)) },
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
  },
});
