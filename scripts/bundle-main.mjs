// 将 Electron 主进程连同 electron-updater 及其依赖树打包为单文件 CJS。
// 必要性：electron-builder files 的 "!node_modules/**/*" 排除会让 updater 的
// fs-extra/js-yaml 等依赖树不进安装包——打进 bundle 后无需维护依赖清单。
// 扩展名 .cjs：package.json "type":"module" 下 .js 会被按 ESM 解析，CJS 内容必崩。
import { rolldown } from 'rolldown'

const bundle = await rolldown({
  input: 'electron/main.js',
  external: ['electron'] // electron 本体由运行时提供，不入包
})
await bundle.write({ file: 'electron/main.bundle.cjs', format: 'cjs' })
console.log('[bundle-main] electron/main.bundle.cjs done')
