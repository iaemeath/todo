/**
 * 弱口令策略单测：前后端共享的单一实现（#129 下沉模式），规则口径以本文件固化。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validatePassword, EMAIL_RE } from '../../src/types/password'

test('长度边界：<8 与 >64 拒绝，8/64 通过', () => {
  assert.equal(validatePassword('a1b2c3d').ok, false)
  assert.equal(validatePassword('a1b2c4d'.padEnd(65, 'x')).ok, false)
  assert.equal(validatePassword('a1b2c3de').ok, true)
})

test('必须同时含字母和数字', () => {
  assert.equal(validatePassword('abcdefgh').ok, false)
  assert.equal(validatePassword('12345678').ok, false) // 同时命中黑名单/纯数字
  assert.equal(validatePassword('a1b2c3de').ok, true)  // 注：abcd1234 在黑名单里，不能当正例
})

test('黑名单命中（大小写不敏感）', () => {
  const r = validatePassword('Password1')
  assert.equal(r.ok, false)
  assert.match(r.reason, /弱密码/)
})

test('纯数字 8 位拒绝（被"字母+数字"规则拦截，纯数字单列规则已移除为死代码）', () => {
  const r = validatePassword('91827364')
  assert.equal(r.ok, false)
  assert.match(r.reason, /字母和数字/)
})

test('密码含邮箱前缀拒绝', () => {
  const r = validatePassword('cly2024xy', 'cly2024@example.com')
  assert.equal(r.ok, false)
  assert.match(r.reason, /账号名/)
  // 前缀 <3 位不触发
  assert.equal(validatePassword('ab1234xy', 'ab@example.com').ok, true)
})

test('连续重复字符占比过高拒绝', () => {
  const r = validatePassword('aaaa1234') // 4/8=50%…max(4, floor(8*0.6)=4) → 命中
  assert.equal(r.ok, false)
  assert.match(r.reason, /重复/)
  assert.equal(validatePassword('a1b2c3d4').ok, true)
})

test('EMAIL_RE 常见格式判定', () => {
  assert.equal(EMAIL_RE.test('user.name+tag@ex-ample.co'), true)
  assert.equal(EMAIL_RE.test('a@b.c'), false) // TLD 长度 <2
  assert.equal(EMAIL_RE.test('no-at-sign.com'), false)
  assert.equal(EMAIL_RE.test('a@b..com'), true) // 实用正则放行连续点（域名级校验不在职责内）
})
