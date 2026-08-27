import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pub.ylh.shiguang',
  appName: '拾光',
  webDir: 'dist',
  // 临时：API 尚 http，默认 https scheme 下明文请求被 Mixed Content 拦截；上 HTTPS 后删除
  // 必须嵌在 server 段——CapConfig 只读 server.androidScheme，根级会被静默忽略（8.5 实测）
  server: {
    androidScheme: 'http'
  }
};

export default config;
