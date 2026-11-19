const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createGame } = require('../public/games/asteroids/engine.js')

function seeded() {
  let value = 42
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296 }
}

test('Asteroids starts a shared round with separate ships and bounded weapons', () => {
  const game = createGame(seeded())
  game.addPlayer('one', 'HOST')
  game.addPlayer('two', 'FRIEND')
  assert.equal(game.snapshot().phase, 'ready')
  game.setInput('one', { start: 1, fire: true, thrust: true, right: true })
  game.setInput('two', { start: 0, fire: true, thrust: true, left: true })
  game.step(1 / 60)
  let state = game.snapshot()
  assert.equal(state.phase, 'play')
  assert.equal(state.ships.length, 2)
  assert.equal(state.rocks.length, 4)
  assert.notEqual(state.ships[0].color, state.ships[1].color)
  for (let i = 0; i < 1500; i++) game.step(1 / 60)
  state = game.snapshot()
  assert.ok(state.score > 0, 'shots should destroy rocks and earn points')
  assert.equal(state.score, state.ships.reduce((sum, ship) => sum + ship.score, 0))
  assert.ok(state.bullets.length <= 12)
  for (const ship of state.ships) {
    assert.ok(Number.isFinite(ship.x) && ship.x >= 0 && ship.x < 288)
    assert.ok(Number.isFinite(ship.y) && ship.y >= 0 && ship.y < 148)
  }
  assert.ok(state.rocks.some(rock => rock.size < 3), 'rocks split into smaller pieces')
  state.score = -100
  assert.ok(game.snapshot().score >= 0, 'snapshots cannot mutate the game')
  game.removePlayer('two')
  assert.equal(game.snapshot().ships.length, 1)
  assert.ok(game.snapshot().bullets.every(bullet => bullet.owner !== 'two'))
})

test('all lives run out, then a new start command resets the squad', () => {
  const game = createGame(seeded())
  game.addPlayer('pilot', 'PILOT')
  game.setInput('pilot', { start: 1 })
  for (let i = 0; i < 36000 && game.snapshot().phase !== 'over'; i++) game.step(.05)
  let state = game.snapshot()
  assert.equal(state.phase, 'over')
  assert.equal(state.ships[0].lives, 0)
  assert.equal(state.round, 1)
  game.setInput('pilot', { start: 2 })
  game.step(.016)
  state = game.snapshot()
  assert.equal(state.phase, 'play')
  assert.equal(state.round, 2)
  assert.equal(state.ships[0].lives, 3)
  assert.equal(state.score, 0)
  assert.equal(state.wave, 1)
})
