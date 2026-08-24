/**
 * 弱口令策略：前后端共享的零依赖纯模块（server 直接 import，同 bundle.ts 下沉模式）。
 * 规则来源：国内弱密码年度榜单 + 5 类高危弱口令（纯数字、键盘序列、简单重复、常见单词、含账号名）。
 * 前端用于输入即时提示，服务端为最终把关——两端同源，不会出现"前端过后端拒"的口径漂移。
 */

/** 常见弱密码黑名单（小写比对，覆盖各年度 Top 榜高频项） */
export const WEAK_PASSWORDS: ReadonlySet<string> = new Set([
  // 纯数字序列
  '123456', '1234567', '12345678', '123456789', '1234567890',
  '0123456789', '987654321', '87654321', '111111', '222222',
  '333333', '666666', '888888', '999999', '000000',
  '123123', '121212', '112233', '223344', '336699',
  '654321', '567890', '456789', '147258369', '159357',
  // 键盘序列 / 图案
  'qwerty', 'qwertyuiop', 'asdfgh', 'asdfghjkl', 'zxcvbn',
  'zxcvbnm', 'qazwsx', 'wsad1234', '1qaz2wsx', '1q2w3e4r',
  'qwe123', 'abc123', 'abcd1234', 'a123456', 'a12345678',
  // 常见单词 + 数字
  'password', 'password1', 'p@ssw0rd', 'passw0rd', 'passwd',
  'admin', 'admin123', 'admin888', 'administrator', 'root',
  'user', 'guest', 'test', 'test123', 'demo',
  'login', 'letmein', 'welcome', 'monkey', 'dragon',
  'master', 'shadow', 'sunshine', 'princess', 'football',
  'iloveyou', 'zaq12wsx',
  // 中文场景高频
  'woaini', 'woaini520', 'woaini1314', '5201314', '1314520',
  'aini1314', '201314', '7758521', '521521', '168168',
  'taobao', 'alibaba', 'baidu', 'qq123456', 'asdasd',
  '1qazxsw2', 'qqqqqq', 'aaaaaa', 'abcdef', 'abcdefg'
])

/** 弱口令规则：连续重复字符占比过高（如 aaaaaabbbb） */
function isMostlyRepeated(pwd: string): boolean {
  const chars = [...pwd]
  const counts = new Map<string, number>()
  for (const c of chars) counts.set(c, (counts.get(c) || 0) + 1)
  const max = Math.max(...counts.values())
  return max >= Math.max(4, Math.floor(pwd.length * 0.6))
}

export interface PasswordCheck {
  ok: boolean
  /** 不通过时给用户看的原因（中文） */
  reason: string
}

/**
 * 校验密码强度。account 传邮箱（取前缀比对）或用户名，用于"密码含账号名"检测。
 * 规则：8~64 位 / 至少含字母和数字 / 非纯数字 / 不含账号前缀 / 不在黑名单 / 非连续重复。
 */
export function validatePassword(pwd: string, account = ''): PasswordCheck {
  if (pwd.length < 8 || pwd.length > 64) return { ok: false, reason: '密码长度需 8~64 位' }
  if (!/[a-zA-Z]/.test(pwd) || !/[0-9]/.test(pwd)) {
    return { ok: false, reason: '密码需同时包含字母和数字' }
  }
  if (WEAK_PASSWORDS.has(pwd.toLowerCase())) {
    return { ok: false, reason: '密码属于常见弱密码，请更换' }
  }
  // 纯数字黑名单变体：任意 6+ 位纯数字一律拒（qwerty 类已由黑名单覆盖）
  if (/^\d{6,}$/.test(pwd)) return { ok: false, reason: '纯数字密码容易被暴力破解，请加入字母' }

  const prefix = account.split('@')[0]?.toLowerCase() || account.toLowerCase()
  if (prefix.length >= 3 && pwd.toLowerCase().includes(prefix)) {
    return { ok: false, reason: '密码不能包含邮箱前缀/账号名' }
  }
  if (isMostlyRepeated(pwd)) return { ok: false, reason: '密码重复字符过多，请更换' }
  return { ok: true, reason: '' }
}

/** 邮箱格式校验（够用的实用正则，非 RFC 全集） */
export const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
