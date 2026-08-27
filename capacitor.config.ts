import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pub.ylh.shiguang',
  appName: '拾光',
  webDir: 'dist',
  // 【临时·勿长期保留】API 服务器暂为 http（weekly.rl.ylh.pub），默认 https scheme 下
  // 壳内 origin=https://localhost 属安全上下文，fetch 明文 API 被 Mixed Content 硬拦
  // （表象=登录"网络不可达"）。降到 http scheme 解锁明文请求。
  // ⚠️ 副作用：① origin 变更 → localStorage 隔离，旧 origin 下的壳内本地数据不随迁；
  // ② Wake Lock（屏保长亮）依赖安全上下文——http://localhost 属"潜在可信"豁免，
  // 大概率仍可用，以真机验证为准。服务器上 HTTPS 后应删除本行回默认 https。
  androidScheme: 'http'
};

export default config;
