<script setup lang="ts">
/** 頭像＋名字顯示（唯讀）。修改名字在「個人」頁。未登入時不顯示。 */
const { me } = useMe();
</script>

<template>
  <div v-if="me" :style="{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }">
    <div
      :style="{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: 'var(--fill-control)',
        backgroundImage: me.pictureUrl ? `url(${me.pictureUrl})` : undefined,
        backgroundSize: 'cover',
        flex: 'none',
      }"
    />
    <div>
      <p :style="{ margin: 0, fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)' }">
        {{ me.realName ?? me.displayName }}
      </p>
      <!-- LINE 名稱永遠唯讀，每次登入自動從 LINE 覆寫 -->
      <p :style="{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-muted)' }">
        LINE 名稱：{{ me.displayName }}
      </p>
    </div>
  </div>
</template>
