-- 046_revoke_rls_auto_enable.sql —— 收回 rls_auto_enable() 的前端執行權限（Nuxt 版專用）
--
-- 這支函式不是 001～045 建的：建立 Supabase 專案時勾選「新資料表自動開 RLS」，Supabase 會建立
-- 事件觸發器 ensure_rls 與它呼叫的 rls_auto_enable()（SECURITY DEFINER）。
-- 它回傳 event_trigger，從 API 呼叫只會報錯、沒有實際風險；但安全檢查會對 anon／authenticated
-- 可執行的 SECURITY DEFINER 函式發警告。事件觸發器由資料庫自己觸發、不檢查 EXECUTE 權限，
-- 收回後自動開 RLS 的功能照常運作。

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
