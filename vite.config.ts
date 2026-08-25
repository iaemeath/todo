import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// 构建时版本号注入（Web 端版本检查比对用，见 services/versionCheck.ts）
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))

// https://vite.dev/config/
export default defineConfig({
  // 相对路径 base：Electron 以 file:// 加载 dist 时，绝对路径 /assets/ 会指向盘根导致白屏；
  // web 部署在 nginx 站点根下相对引用同样成立，两种场景一份产物。
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()]
    }),
    Components({
      resolvers: [ElementPlusResolver()]
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 5177,
    strictPort: true,
    // 开发期后端转发：本地 server/（Express，127.0.0.1:8787）
    proxy: {
      '/api': 'http://127.0.0.1:8787'
    }
  }
})
