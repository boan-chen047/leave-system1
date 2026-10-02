<script setup lang="ts">
import { computed } from 'vue';
import { setupStage } from '#shared/utils/setup';

/**
 * 首次設定三關，依序：確認名字 → 同意條款 → 退費途徑（前一關完成才放行下一關，不能關閉略過）。
 * 目前卡在哪一關由 shared/utils/setup.ts 的 setupStage() 決定。
 *
 * 與 Next.js 版差異：原本只放在首頁，從其他頁直接開啟就會略過；
 * 這裡由 AuthGate 在所有需登入的頁面掛上，不論從哪一頁進來都會先完成設定。
 */
const { me, refresh } = useMe();
const stage = computed(() => setupStage(me.value));
</script>

<template>
  <NameDialog :open="stage === 'name'" mode="first" @saved="refresh" />
  <ConsentDialog :open="stage === 'terms'" @saved="refresh" />
  <RefundDialog :open="stage === 'refund'" mode="first" @saved="refresh" />
</template>
