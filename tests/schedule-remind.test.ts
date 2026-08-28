/**
 * 每日程提醒量（remindMinutes）纯函数单测（node:test）。
 * 覆盖：预设档解析/格式化（formatRemindLabel / parseRemindInput）、落库域校验
 * （isValidRemindMinutes）、sanitizeSchedules 的提醒量归一（缺失/非法回退 0）。
 * 均为无 DOM 依赖的纯函数，直接静态 import（无需 helpers 的浏览器 stub）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  REMIND_NEVER,
  REMIND_MAX,
  formatRemindLabel,
  parseRemindInput,
  isValidRemindMinutes
} from '../src/constants/schedule'
import { sanitizeSchedules, type Schedule } from '../src/types/bundle'

// ===== formatRemindLabel =====

test('formatRemindLabel：特殊值与普通分钟数', () => {
  assert.equal(formatRemindLabel(REMIND_NEVER), '不提醒')
  assert.equal(formatRemindLabel(0), '准时（开始时刻）')
  assert.equal(formatRemindLabel(60), '提前 1 小时')
  assert.equal(formatRemindLabel(45), '提前 45 分钟')
})

// ===== parseRemindInput =====

test('parseRemindInput：预设档字符串与自定义分钟数', () => {
  assert.equal(parseRemindInput('0'), 0)
  assert.equal(parseRemindInput('5'), 5)
  assert.equal(parseRemindInput('60'), 60)
  assert.equal(parseRemindInput('-1'), REMIND_NEVER) // 键入 -1 等价「不提醒」
  assert.equal(parseRemindInput('45'), 45)
  assert.equal(parseRemindInput('10080'), REMIND_MAX)
})

test('parseRemindInput：非法输入一律 null', () => {
  assert.equal(parseRemindInput(''), null)
  assert.equal(parseRemindInput('abc'), null)
  assert.equal(parseRemindInput('1.5'), null)
  assert.equal(parseRemindInput('-2'), null)
  assert.equal(parseRemindInput('10081'), null)
  // @ts-expect-error 运行时防手改数据：非字符串输入也须拒绝
  assert.equal(parseRemindInput(null), null)
})

// ===== isValidRemindMinutes =====

test('isValidRemindMinutes：域校验', () => {
  assert.equal(isValidRemindMinutes(0), true)
  assert.equal(isValidRemindMinutes(-1), true)
  assert.equal(isValidRemindMinutes(10080), true)
  assert.equal(isValidRemindMinutes(1.5), false)
  assert.equal(isValidRemindMinutes(-2), false)
  assert.equal(isValidRemindMinutes('5'), false)
  assert.equal(isValidRemindMinutes(undefined), false)
})

// ===== sanitizeSchedules 提醒量归一 =====

const base = { title: 't', date: '2026-08-28', startTime: '09:00', endTime: '10:00', color: 'blue' } as const

test('sanitizeSchedules：缺失/非法提醒量回退 0（准时），合法值保留', () => {
  const list = [
    { ...base, id: 'a' }, // 缺字段（老结构/手改 JSON）
    { ...base, id: 'b', remindMinutes: 10 },
    { ...base, id: 'c', remindMinutes: -1 },
    { ...base, id: 'd', remindMinutes: 2.5 }, // 非整数
    { ...base, id: 'e', remindMinutes: '5' } // 非数字类型
  ] as unknown as Schedule[]
  const by = Object.fromEntries(sanitizeSchedules(list).map((s) => [s.id, s]))
  assert.equal(by.a.remindMinutes, 0)
  assert.equal(by.b.remindMinutes, 10)
  assert.equal(by.c.remindMinutes, -1)
  assert.equal(by.d.remindMinutes, 0)
  assert.equal(by.e.remindMinutes, 0)
})
