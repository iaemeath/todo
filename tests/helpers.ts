/**
 * 前端单测环境装配（node:test + tsx，零新依赖，模式同 server/test）。
 *
 * 关键约束：必须在【动态 import 任何生产模块之前】执行 installBrowserStubs()——
 * syncManager 模块顶层就读 localStorage，apiClient 顶层探测 window，
 * stores 链（ui → router）创建 hash 路由时要读 location。
 * 静态 import 会因提升时序导致 stub 装配晚于模块求值，一律用动态 import。
 */

interface LSStub extends Storage {
  _map: Map<string, string>
}

/** 浏览器全局最小实现：localStorage（内存 Map）+ window/location/history/document/matchMedia */
export function installBrowserStubs(): void {
  const g = globalThis as Record<string, unknown>

  const map = new Map<string, string>()
  const ls: LSStub = Object.assign(
    {
      _map: map,
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => void map.set(k, String(v)),
      removeItem: (k: string) => void map.delete(k),
      clear: () => void map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null
    },
    { get length() { return map.size } }
  )
  g.localStorage = ls

  g.location = {
    href: 'http://localhost/#/',
    protocol: 'http:',
    host: 'localhost',
    hostname: 'localhost',
    origin: 'http://localhost',
    pathname: '/',
    search: '',
    hash: '#/'
  }
  g.history = { state: null, pushState() {}, replaceState() {}, back() {}, go() {} }
  // vue runtime-dom 模块加载期会 createElement("template")——给个宽松的哑元素即可（测试不触真实 DOM 路径）
  const dummyEl = () => ({
    style: { setProperty() {} },
    setAttribute() {},
    appendChild() {},
    addEventListener() {},
    removeEventListener() {}
  })
  g.document = {
    documentElement: {
      style: { setProperty() {} },
      setAttribute() {},
      classList: { toggle() {} }
    },
    createElement: dummyEl,
    createElementNS: dummyEl,
    createTextNode: () => ({}),
    querySelector: () => null,
    addEventListener() {},
    removeEventListener() {}
  }
  g.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {}
  })
  // navigator 在 Node 21+ 是 getter-only 全局，必须 defineProperty 覆写
  Object.defineProperty(g, 'navigator', { value: { userAgent: 'node-test' }, configurable: true })
  // vue-router createWebHistory 创建期挂 popstate 监听（window === globalThis）
  g.addEventListener = () => {}
  g.removeEventListener = () => {}
  g.dispatchEvent = () => true
  // window = globalThis：让 `typeof window !== 'undefined'` 分支走通并共享上述全局
  g.window = g
}

/** 伪造登录态（写入 localStorage——auth store 惰性创建时从这里恢复） */
export function fakeLogin(): void {
  localStorage.setItem('shiguang_token', 'test-token')
  localStorage.setItem('shiguang_user', JSON.stringify({ id: 'u1', email: 'test@local', username: null }))
}

/** 每例新 pinia：stores 是 per-pinia 单例，新实例即全新数据（模块级单例另由 stopSync 复位） */
export async function freshPinia(): Promise<void> {
  const { createPinia, setActivePinia } = await import('pinia')
  setActivePinia(createPinia())
}

/** 每例统一收尾：停同步（清基线/游标/SSE）+ 清 localStorage */
export async function resetBetweenTests(): Promise<void> {
  const sm = await import('../src/services/syncManager')
  sm.stopSync()
  localStorage.clear()
  await freshPinia()
}

// ===== fetch stub =====

export interface CapturedCall {
  url: string
  init: RequestInit
  body: unknown // JSON 解析好的请求体（无 body 为 null）
}

export interface FetchRoute {
  /** URL 含该子串即命中 */
  match: string
  /** 返回 API envelope 的 data 字段；throw 则模拟网络层失败 */
  reply: (call: CapturedCall) => unknown
}

/**
 * 替换全局 fetch：按 URL 子串路由。apiClient 对响应只碰 ok/status/json() 三个成员，
 * 字面量对象即可冒充 Response，无需构造真实 Response。
 */
export function stubFetch(routes: FetchRoute[]): CapturedCall[] {
  const calls: CapturedCall[] = []
  ;(globalThis as { fetch: unknown }).fetch = (async (url: string | URL, init: RequestInit = {}) => {
    const u = String(url)
    let body: unknown = null
    if (typeof init.body === 'string') { try { body = JSON.parse(init.body) } catch { body = init.body } }
    const call: CapturedCall = { url: u, init, body }
    calls.push(call)
    const route = routes.find((r) => u.includes(r.match))
    if (!route) throw new Error(`unmocked fetch: ${u}`)
    const data = route.reply(call) // throw 在此向外冒泡 → apiClient 转成 ApiError(0)
    return { ok: true, status: 200, json: async () => ({ ok: true, data }) }
  }) as typeof fetch
  return calls
}

export const pushCalls = (calls: CapturedCall[]) => calls.filter((c) => c.url.includes('/sync/push'))
export const pullCalls = (calls: CapturedCall[]) => calls.filter((c) => c.url.includes('/sync/pull'))

/** 等待微任务/宏任务队列排空（syncNow 内部 pull 是 void 不等 await，靠轮询收敛） */
export const settle = async (rounds = 12): Promise<void> => {
  for (let i = 0; i < rounds; i++) await new Promise((r) => setTimeout(r, 1))
}
