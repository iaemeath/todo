/**
 * 数据契约层单测：parseBundle 结构校验 + sanitize 净化规则。
 * 契约层是导入恢复的唯一防线（非法文件不得进入 store），规则变化必须伴随这里的用例。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseBundle, sanitizeTasks, sanitizeSchedules,
  BUNDLE_VERSION, defaultSettings
} from '../../src/types/bundle'

// ---- parseBundle：结构校验与宽松回退 ----

test('parseBundle 拒绝非对象与缺核心数组的输入', () => {
  assert.equal(parseBundle(null), null)
  assert.equal(parseBundle('x'), null)
  assert.equal(parseBundle({}), null) // 缺 tasks/schedules
  assert.equal(parseBundle({ tasks: 'no' , schedules: [] }), null)
  assert.equal(parseBundle({ tasks: [], schedules: {} }), null)
})

test('parseBundle 最小合法输入回退默认值', () => {
  const b = parseBundle({ tasks: [], schedules: [] })!
  assert.equal(b.version, BUNDLE_VERSION)
  assert.deepEqual(b.settings, defaultSettings)
  assert.equal(b.theme.isDark, false)
  assert.deepEqual(b.usage, [])
  assert.equal(b.todoVisible, true) // 缺省 true
  assert.equal(b.exportedAt, '')
})

test('parseBundle 保留合法自定义字段', () => {
  const raw = {
    version: 99, exportedAt: '2026-01-01T00:00:00Z',
    tasks: [], schedules: [],
    settings: { apiKey: 'sk-x', startHour: 6 },
    theme: { isDark: true }, usage: [], todoVisible: false
  }
  const b = parseBundle(raw)!
  assert.equal(b.version, 99)
  assert.equal(b.exportedAt, '2026-01-01T00:00:00Z')
  assert.equal(b.settings.apiKey, 'sk-x')
  assert.equal(b.settings.startHour, 6)
  assert.equal(b.settings.endHour, defaultSettings.endHour) // 未给字段回默认
  assert.equal(b.theme.isDark, true)
  assert.equal(b.todoVisible, false)
})

// ---- sanitizeTasks：非法过滤 + 孤儿提升 ----

test('sanitizeTasks 过滤无 id/无 title 的条目', () => {
  const out = sanitizeTasks([
    { id: 'a', parentId: null, title: 'ok', description: '', category: 'work', important: true, urgent: true, completed: false, order: 0 },
    { id: '', parentId: null, title: '空 id', description: '', category: 'work', important: true, urgent: true, completed: false, order: 1 },
    { id: 'b', parentId: null, title: '', description: '', category: 'work', important: true, urgent: true, completed: false, order: 2 },
    null as never
  ])
  assert.equal(out.length, 1)
  assert.equal(out[0].id, 'a')
})

test('sanitizeTasks 把孤儿任务（parentId 悬空）提升为顶级', () => {
  const out = sanitizeTasks([
    { id: 'p', parentId: null, title: '父', description: '', category: 'work', important: true, urgent: true, completed: false, order: 0 },
    { id: 'c1', parentId: 'p', title: '正常子', description: '', category: 'work', important: true, urgent: true, completed: false, order: 0 },
    { id: 'c2', parentId: 'ghost', title: '孤儿', description: '', category: 'work', important: true, urgent: true, completed: false, order: 1 }
  ])
  assert.equal(out.find(t => t.id === 'c1')!.parentId, 'p')
  assert.equal(out.find(t => t.id === 'c2')!.parentId, null) // ghost 不存在 → 顶级
})

test('sanitizeTasks 把象限两轴归一为布尔（旧数据缺字段按 false）', () => {
  const out = sanitizeTasks([
    { id: 'a', parentId: null, title: '旧格式', description: '', category: 'work', completed: false, order: 0 } as never,
    { id: 'b', parentId: null, title: '脏数据', description: '', category: 'work', important: 'yes', urgent: 1, completed: false, order: 1 } as never
  ])
  assert.equal(out[0].important, false) // 缺字段 → false
  assert.equal(out[0].urgent, false)
  assert.equal(out[1].important, false) // 非 true 字面量 → false
  assert.equal(out[1].urgent, false)
})

// ---- sanitizeSchedules：格式校验 + 时间补零 ----

test('sanitizeSchedules 拒绝非法日期/时间格式', () => {
  const mk = (over: Record<string, string>) => ({
    id: 's', title: '日程', date: '2026-08-25', startTime: '09:00', endTime: '10:00', color: 'blue', ...over
  })
  const out = sanitizeSchedules([
    mk({}),
    mk({ date: '2026/08/25' }),   // 日期格式错
    mk({ startTime: '9:00' }),    // 未补零（这个是合法输入，应被归一保留）
    mk({ endTime: '25:99' })      // 时间数值非法但格式 \d:\d\d 通过——归一化范围之外
  ])
  assert.equal(out.length, 3) // 仅日期格式错被拒
})

test('sanitizeSchedules 把未补零小时归一为 HH:mm；个位数分钟被 TIME_RE 直接过滤', () => {
  const mk = (startTime: string) => [{
    id: 's', title: '日程', date: '2026-08-25', startTime, endTime: '10:00', color: 'blue'
  }]
  assert.equal(sanitizeSchedules(mk('9:00'))[0].startTime, '09:00') // 语音解析的真实产物形态
  assert.equal(sanitizeSchedules(mk('9:7')).length, 0) // \d{2} 拦截个位数分钟，不进归一化
})
