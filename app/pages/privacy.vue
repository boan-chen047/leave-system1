<script setup lang="ts">
/**
 * 隱私權政策（公開頁，不需 LINE 登入；Google OAuth 發布正式版要求要有公開的隱私權政策網址）。
 * 內容沿用 Next.js 版（最後更新 2026-09-11，對應 shared/utils/terms.ts 的 CURRENT_TERMS_VERSION）。
 * 政策內容實質變更時，要同時更新這頁與 CURRENT_TERMS_VERSION，所有人才會被要求重新同意。
 */
definePageMeta({ public: true, layout: false });
useHead({ title: '隱私權政策｜請假系統' });

const section = { margin: '24px 0 0' };
const h2 = { margin: '0 0 8px', fontSize: '18px', fontWeight: 600 };
const p = { margin: '0 0 8px', fontSize: '15px', lineHeight: 1.8, color: 'var(--text-secondary)' };
const li = { ...p, margin: '0 0 4px' };
const ul = { margin: 0, paddingLeft: '20px' };
</script>

<template>
  <main
    :style="{
      maxWidth: '640px',
      margin: '0 auto',
      padding: '32px 20px 56px',
      minHeight: '100dvh',
      color: 'var(--text-primary)',
      background: 'var(--surface-2)',
    }"
  >
    <BackLink />
    <h1 :style="{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700 }">隱私權政策</h1>
    <p :style="{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-muted)' }">最後更新：2026 年 9 月 11 日</p>
    <p :style="p">
      本系統是球隊用來管理場次請假、銷假與出缺席的內部工具，透過 LINE 登入使用。以下說明我們會蒐集哪些資料、如何使用與保存。
    </p>

    <section :style="section">
      <h2 :style="h2">我們蒐集哪些資料</h2>
      <ul :style="ul">
        <li :style="li">
          <strong>來自 LINE</strong>：你的顯示名稱、大頭貼、LINE 使用者 ID——用來辨識你的身分，讓你免帳號密碼即可登入。
        </li>
        <li :style="li">
          <strong>你填寫的</strong>：暱稱（綽號）——讓管理員在名單與統計上對得上人；我們不強制蒐集你的真實姓名。
        </li>
        <li :style="li"><strong>使用中產生的</strong>：你的請假／銷假紀錄，以及你在各場次的出缺席。</li>
      </ul>
    </section>

    <section :style="section">
      <h2 :style="h2">資料用途</h2>
      <ul :style="ul">
        <li :style="li">辨識你的身分、顯示你自己的請假紀錄與出缺席。</li>
        <li :style="li">提供管理員查看成員名單、各場次的請假名單，以及出缺席統計。</li>
        <li :style="li">本系統不涉及任何金流、不投放廣告，也不會販售你的個人資料。</li>
      </ul>
    </section>

    <section :style="section">
      <h2 :style="h2">資料保存與委外服務</h2>
      <p :style="p">
        資料存放於 Supabase（資料庫）與 Vercel（網站代管）；年度統計報表會另外備份到管理者的 Google Drive。這些都是系統運作所需的服務供應商，我們不會把你的資料另外提供給與本系統無關的第三方。
      </p>
    </section>

    <section :style="section">
      <h2 :style="h2">保存期間</h2>
      <ul :style="ul">
        <li :style="li">請假／銷假逐筆明細：保留約 2 年。</li>
        <li :style="li">出缺席統計快照（每人每月／季／年的數字）：長期保留，供歷年統計。</li>
        <li :style="li">年度報表備份檔：保留約 5 年。</li>
        <li :style="li">帳號與退費資料（含銀行帳號）：帳號存續期間保留，並適用下方「自動刪除」。</li>
      </ul>
    </section>

    <section :style="section">
      <h2 :style="h2">連續 5 年未登入自動刪除</h2>
      <p :style="p">
        若你連續 5 年未登入本系統，系統會自動刪除你的帳號與所有個人資料，包含暱稱（綽號）、LINE 資訊、退費途徑與銀行帳號、你的請假紀錄，以及你在各期別的出缺席統計。此刪除不可復原；要繼續保留資料，只要在期間內登入即可重新計算。
      </p>
    </section>

    <section :style="section">
      <h2 :style="h2">你的權利</h2>
      <p :style="p">
        你可以請管理員停用你的帳號，或協助更正、刪除你的個人資料。停用後，你不會再出現在新的名單與統計中；為了歷史對帳的完整，過去期別的統計數字仍會保留（但仍適用上方「連續 5 年未登入自動刪除」）。
      </p>
    </section>

    <section :style="section">
      <h2 :style="h2">聯絡方式</h2>
      <p :style="p">對本政策或你的資料有任何疑問，請聯絡球隊管理員。</p>
    </section>
  </main>
</template>
