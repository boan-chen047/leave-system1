// 擴充頁面設定（definePageMeta）的型別。
declare module '#app' {
  interface PageMeta {
    /** 不需登入即可瀏覽的公開頁（例：隱私權政策）。AuthGate 會跳過整個登入流程。 */
    public?: boolean;
  }
}

export {};
