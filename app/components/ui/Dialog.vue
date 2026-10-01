<script setup lang="ts">
defineProps<{ open: boolean; title: string }>();
</script>

<!--
  所有彈窗共用同一個殼：固定 320×320，標題在上、按鈕貼底、
  中間內容區吸收高度差。這樣不論開哪個彈窗，確定鍵永遠在同一位置。
  插槽：default＝內容區（會被 flex:1 撐開）、footer＝按鈕組（固定貼底）。
-->
<template>
  <div
    v-if="open"
    role="dialog"
    aria-modal="true"
    :style="{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      zIndex: 50,
    }"
  >
    <div
      :style="{
        background: 'var(--surface-2)',
        borderRadius: '12px',
        padding: '20px',
        width: '100%',
        maxWidth: '320px',
        // 小彈窗維持 320（確定鍵位置一致）；內容較多時往下長、最高不超過可視高度，
        // 內容區自己捲，按鈕永遠貼底不被裁切。
        minHeight: '320px',
        maxHeight: 'calc(100dvh - 40px)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }"
    >
      <p :style="{ margin: '0 0 14px', fontSize: '21px', fontWeight: 600, textAlign: 'center' }">
        {{ title }}
      </p>
      <div :style="{ flex: 1, minHeight: 0, overflowY: 'auto' }">
        <slot />
      </div>
      <slot name="footer" />
    </div>
  </div>
</template>
