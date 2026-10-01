<!--
  成員頁共用版面（請假／銷假／紀錄／個人）：
  整頁固定一個螢幕高，內容區自己捲動，底部分頁列永遠釘在螢幕最下方、不被內容頂走。
  原 Next.js 版是每一頁各自寫這層外框＋TabBar；Nuxt 用 layout 只寫一次。
-->
<template>
  <main
    :style="{
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--surface-2)',
      overflow: 'hidden',
    }"
  >
    <div
      :style="{
        padding: '20px 14px 24px',
        flex: 1,
        overflowY: 'auto',
        minHeight: 0,
        WebkitOverflowScrolling: 'touch',
      }"
    >
      <slot />
    </div>
    <TabBar />
  </main>
</template>
