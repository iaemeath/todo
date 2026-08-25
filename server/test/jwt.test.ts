/**
 * 手写 JWT 签验单测：往返 / 过期 / 篡改。
 * SECRET 读 data/secret.key（dev 环境已存在；测试只验证行为不验证密钥值）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signJwt, verifyJwt } from '../jwt'

test('签发→校验往返：payload 完整保留', () => {
  const token = signJwt('u-test', 't@example.com', 3, 60)
  const payload = verifyJwt(token)
  assert.ok(payload)
  assert.equal(payload!.uid, 'u-test')
  assert.equal(payload!.email, 't@example.com')
  assert.equal(payload!.ver, 3)
  assert.ok(payload!.exp > payload!.iat)
})

test('过期 token 拒绝', () => {
  const token = signJwt('u-test', 't@example.com', 0, -10)
  assert.equal(verifyJwt(token), null)
})

test('篡改 payload 签名失配拒绝', () => {
  const token = signJwt('u-test', 't@example.com', 0, 60)
  const [h, p, s] = token.split('.')
  // 把 uid 改成别人（base64url 重编码）
  const forged = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'))
  forged.uid = 'u-admin'
  const forgedP = Buffer.from(JSON.stringify(forged), 'utf8').toString('base64url')
  assert.equal(verifyJwt(`${h}.${forgedP}.${s}`), null)
})

test('结构非法 token 拒绝', () => {
  assert.equal(verifyJwt('not-a-jwt'), null)
  assert.equal(verifyJwt('a.b'), null)
  assert.equal(verifyJwt(`${'x'.repeat(10)}.${'y'.repeat(20)}.${'z'.repeat(30)}`), null)
})
