const { test } = require('node:test')
const assert = require('node:assert/strict')
const server = require('../server.cjs')

const state = {
  x: 496, y: 300, scene: 'town', direction: 0, frame: 0,
  appearance: {
    name: 'FRIEND', skin: '#e8b890', hair: 0, hairc: '#6b3a1e',
    cap: 1, ccol: '#4a6ae0', shirt: 0, scol: '#d84a4a',
    pants: '#2a3a6a', shoe: '#2a1a14', acc: 0
  }
}

test('friends share positions while rooms and session tokens remain isolated', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = 'http://127.0.0.1:' + server.address().port
  const post = async (route, body) => {
    const response = await fetch(base + '/api/' + route, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    return { status: response.status, body: await response.json() }
  }
  try {
    const created = await post('rooms', { state })
    assert.equal(created.status, 200)
    const first = created.body
    const joined = await post('join', { code: first.code.toLowerCase(), state })
    assert.equal(joined.status, 200)
    const second = joined.body
    await post('sync', { ...second, state: { ...state, x: 520, direction: 3 } })
    const snapshot = await post('sync', { ...first, state })
    assert.equal(snapshot.body.players.length, 2)
    assert.equal(snapshot.body.players.find(p => p.id === second.id).x, 520)
    assert.ok(snapshot.body.players.every(p => !('token' in p)))
    const other = (await post('rooms', { state })).body
    assert.equal((await post('sync', { ...other, state })).body.players.length, 1)
    assert.equal((await post('sync', { ...first, token: second.token + 'bad', state })).status, 410)
    assert.equal((await post('sync', { ...first, state: { ...state, x: -1 } })).status, 400)
    assert.equal((await post('join', { code: '00000000', state })).status, 404)
    for (let i = 0; i < 6; i++) assert.equal((await post('join', { code: first.code, state })).status, 200)
    assert.equal((await post('join', { code: first.code, state })).status, 409)
    assert.equal((await post('leave', second)).status, 200)
    assert.equal((await post('sync', { ...first, state })).body.players.length, 7)
    const hostile = await fetch(base + '/api/rooms', {
      method: 'POST', headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ state })
    })
    assert.equal(hostile.status, 403)
    const large = await post('rooms', { state, extra: 'x'.repeat(5000) })
    assert.equal(large.status, 413)
    const flightState = { ...state, x: 160, y: 90, scene: 'asteroids', asteroidsInput: { start: 0 } }
    const flightRoom = (await post('rooms', { state: flightState })).body
    const wingman = (await post('join', { code: flightRoom.code, state: flightState })).body
    await post('sync', { ...wingman, state: flightState })
    let flight = await post('sync', { ...flightRoom, state: flightState })
    assert.equal(flight.body.asteroids.ships.length, 2)
    await new Promise(resolve => setTimeout(resolve, 25))
    flight = await post('sync', { ...flightRoom, state: { ...flightState, asteroidsInput: { start: 1, fire: true } } })
    assert.equal(flight.body.asteroids.phase, 'play')
    assert.equal(flight.body.asteroids.wave, 1)
    assert.ok(flight.body.asteroids.bullets.length > 0)
    const wingSnapshot = await post('sync', { ...wingman, state: flightState })
    assert.equal(wingSnapshot.body.asteroids.round, flight.body.asteroids.round)
    assert.equal(wingSnapshot.body.asteroids.ships.length, 2)
    await post('leave', wingman)
    flight = await post('sync', { ...flightRoom, state: flightState })
    assert.equal(flight.body.asteroids.ships.length, 1)
    assert.equal((await post('sync', { ...first, state })).body.asteroids, undefined)
    await post('leave', flightRoom)
    const now = Date.now
    try {
      Date.now = () => now() + 31000
      assert.equal((await post('sync', { ...other, state })).status, 410)
    } finally { Date.now = now }
    for (const file of ['/', '/multiplayer.js', '/village/explore.js']) {
      assert.equal((await fetch(base + file)).status, 200)
    }
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})
