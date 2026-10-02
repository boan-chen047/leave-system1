import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * 伺服器端專用的 Supabase 連線（service role 金鑰，會繞過 RLS）。
 * 只放在 server/ 底下：Nuxt 不會把 server/ 的程式打包進瀏覽器，金鑰不會外洩。
 *
 * 模組層單例：同一個伺服器執行個體內共用同一個 client，不必每個請求都重建。
 */
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const { supabaseUrl, supabaseServiceRoleKey } = useRuntimeConfig();
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    // 用 message 不用 statusMessage：statusMessage 會放進 HTTP 狀態列，只能是英數字，中文會被濾掉
    throw createError({ statusCode: 500, message: '缺少 Supabase 環境變數（NUXT_SUPABASE_URL／NUXT_SUPABASE_SERVICE_ROLE_KEY）' });
  }
  cached = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });
  return cached;
}
