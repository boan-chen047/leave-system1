// API 測試用的假 supabase client（由 Next.js 版 tests/helpers/fakeDb.ts 原樣搬來）。
// - from(table) 回傳可任意鏈式呼叫的查詢物件（select/eq/lte/or/in/order/limit/insert/update/delete…），
//   每次呼叫都記進 ops，最後 await／single()／maybeSingle() 時，依資料表的 handler 決定回應。
// - rpc(name, args) 記下名稱與參數，回應同樣由 handler 決定。
// handler 可以是固定回應，或依本次查詢的 ops 動態回應（同一張表在一支路由裡被查兩次時用）。

export type Resp = { data: unknown; error: unknown; count?: number | null };
export type QueryLog = { table: string; ops: unknown[][] };
type TableHandler = Resp | ((q: QueryLog) => Resp);
type RpcHandler = Resp | ((args: Record<string, unknown>) => Resp);

export const ok = (data: unknown): Resp => ({ data, error: null });
export const fail = (message: string, code?: string): Resp => ({ data: null, error: { message, code } });

export function fakeDb(opts: { tables?: Record<string, TableHandler>; rpc?: Record<string, RpcHandler> } = {}) {
  const log = {
    queries: [] as QueryLog[],
    rpcs: [] as { name: string; args: Record<string, unknown> }[],
  };

  function from(table: string) {
    const q: QueryLog = { table, ops: [] };
    log.queries.push(q);
    const resolve = (): Resp => {
      const h = opts.tables?.[table];
      const r = typeof h === 'function' ? h(q) : h;
      return r ?? { data: null, error: null };
    };
    const chain: any = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === 'then') {
            return (onOk: (v: Resp) => unknown, onErr: (e: unknown) => unknown) =>
              Promise.resolve(resolve()).then(onOk, onErr);
          }
          if (prop === 'single' || prop === 'maybeSingle') return async () => resolve();
          return (...args: unknown[]) => {
            q.ops.push([prop, ...args]);
            return chain;
          };
        },
      },
    );
    return chain;
  }

  async function rpc(name: string, args: Record<string, unknown> = {}): Promise<Resp> {
    log.rpcs.push({ name, args });
    const h = opts.rpc?.[name];
    const r = typeof h === 'function' ? h(args) : h;
    return r ?? { data: null, error: null };
  }

  return { db: { from, rpc }, log };
}

/** 查詢紀錄裡是否出現過某個鏈式呼叫（例如 ['eq', 'user_id', 'u1']） */
export function hasOp(q: QueryLog, op: unknown[]): boolean {
  return q.ops.some((o) => JSON.stringify(o) === JSON.stringify(op));
}
