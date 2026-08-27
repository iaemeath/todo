import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pub.ylh.shiguang',
  appName: '拾光',
  webDir: 'dist',
  // 临时：API 尚 http，默认 https scheme 下明文请求被 Mixed Content 拦截；上 HTTPS 后删除本行
  androidScheme: 'http'
};

export default config;
