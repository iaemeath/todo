/**
 * 滑块验证码单测：挑战形态 / 未知挑战 / 错位失败 / 连错烧毁 / token 即焚。
 * 成功路径（正确 x）依赖像素答案，属 GUI E2E 范畴，此处不覆盖。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createChallenge, verifySlider, consumeSliderToken, type TrackPoint } from '../sliderCaptcha'

/** 形态合法的拖动轨迹（真实 pointermove 采样密度） */
const track = (x: number): TrackPoint[] => [
  { t: 0, x: 0 }, { t: 60, x: Math.round(x * 0.3) }, { t: 140, x: Math.round(x * 0.7) }, { t: 220, x }
]

test('createChallenge 返回可用挑战（PNG dataURL + 缺口坐标域）', () => {
  const c = createChallenge('unit-test-ip')
  assert.ok(c)
  assert.ok(c!.id.length > 10)
  assert.match(c!.bg, /^data:image\/png;base64,/)
  assert.match(c!.piece, /^data:image\/png;base64,/)
  assert.ok(c!.pieceY >= 0 && c!.pieceY <= 160)
})

test('未知挑战 id 返回 gone', () => {
  assert.equal(verifySlider('no-such-id', 100, track(100)).status, 'gone')
})

test('错位提交返回 fail；连错 2 次挑战烧毁（MAX_FAILS=2）', () => {
  const c = createChallenge('unit-test-ip-2')!
  // 答案 x 域约 [62,218]（answerX∈[84,240] − PW/2），取两端之外的 5 与 235 保证错位
  assert.equal(verifySlider(c.id, 5, track(5)).status, 'fail')
  assert.equal(verifySlider(c.id, 235, track(235)).status, 'fail')
  assert.equal(verifySlider(c.id, 100, track(100)).status, 'gone') // 已烧毁
})

test('轨迹不合法同样计失败（防直接 set x 的脚本）', () => {
  const c = createChallenge('unit-test-ip-3')!
  const tooFast = [{ t: 0, x: 0 }, { t: 50, x: 100 }] // 点数<3 且 <120ms
  assert.equal(verifySlider(c.id, 100, tooFast).status, 'fail')
  const startFar = [{ t: 0, x: 50 }, { t: 200, x: 100 }, { t: 300, x: 100 }] // 起点远离左端
  // 注：烧毁发生在第 2 次失败的当次调用（仍返回 fail），挑战销毁后下一次才 gone
  assert.equal(verifySlider(c.id, 100, startFar).status, 'fail')
  assert.equal(verifySlider(c.id, 100, startFar).status, 'gone')
})

test('consumeSliderToken：未知 token 拒绝且即焚', () => {
  assert.equal(consumeSliderToken('never-issued'), false)
  assert.equal(consumeSliderToken('never-issued'), false)
})
