/**
 * 角色判定：环境变量 ADMIN_USERS 白名单（逗号分隔用户名）。
 * JWT 不携带角色——中间件实时查白名单，改环境变量重启即生效，无需等 token 过期重签。
 * 未设置时无管理员（管理入口对所有用户隐藏，/api/admin 一律 403）。
 */
const ADMIN_USERS = (process.env.ADMIN_USERS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

export const isAdmin = (username: string): boolean => ADMIN_USERS.includes(username)
