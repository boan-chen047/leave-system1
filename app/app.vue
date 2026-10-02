<!--
  根元件。大螢幕時把整個 app 置中成固定寬度面板（見 main.css .app-frame）；手機版滿版。
  NuxtRouteAnnouncer：換頁時告訴螢幕閱讀器「已切換到哪一頁」（無障礙）。
  AuthGate：登入閘門，未登入／載入中／停用時顯示對應畫面，登入後才顯示頁面（見 components/AuthGate.vue）。
  註解放在 template 外：放在根元素旁會變多根節點（見 components/ui/Button.vue 說明）。
-->
<template>
  <div class="app-frame">
    <NuxtRouteAnnouncer />
    <AuthGate>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </AuthGate>
  </div>
</template>
