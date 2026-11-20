const { randomBytes } = require('node:crypto')

const { createGame } = require('../public/games/asteroids/engine.js')

const MAX_PLAYERS = 8
const IDLE_MS = 30000
const SCENES = new Set(['town', 'inside', 'pong', 'village', 'asteroids-lobby', 'asteroids', 'kart-lobby', 'turbo-lap', 'time-loop-heist'])
const colors = ['skin', 'hairc', 'ccol', 'scol', 'pants', 'shoe']
const styles = { hair: 3, cap: 4, shirt: 2, acc: 3 }

function cleanState(input) {
  if (!input || typeof input !== 'object' || !SCENES.has(input.scene)) return null
  const bounds = input.scene === 'village' ? [2240, 1280] : input.scene === 'town' ? [960, 544] : [320, 180]
  if (!Number.isFinite(input.x) || !Number.isFinite(input.y) ||
      input.x < 0 || input.x > bounds[0] || input.y < 0 || input.y > bounds[1]) return null
  const appearance = input.appearance
  if (!appearance || typeof appearance !== 'object') return null
  const result = {
    scene: input.scene, x: input.x, y: input.y,
    direction: Number.isInteger(input.direction) && input.direction >= 0 && input.direction <= 3 ? input.direction : 0,
    frame: Number.isInteger(input.frame) && input.frame >= 0 && input.frame <= 4 ? input.frame : 0,
    appearance: { name: String(appearance.name || 'HERO').replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 10) || 'HERO' }
  }
  for (const key of colors) {
    if (typeof appearance[key] !== 'string' || !/^#[a-f0-9]{6}$/i.test(appearance[key])) return null
    result.appearance[key] = appearance[key]
  }
  for (const [key, max] of Object.entries(styles)) {
    if (!Number.isInteger(appearance[key]) || appearance[key] < 0 || appearance[key] > max) return null
    result.appearance[key] = appearance[key]
  }
  if (input.scene === 'asteroids') {
    const controls = input.asteroidsInput || {}
    result.asteroidsInput = {
      left: controls.left === true, right: controls.right === true,
      thrust: controls.thrust === true, fire: controls.fire === true,
      start: Number.isSafeInteger(controls.start) && controls.start >= 0 ? controls.start : 0
    }
  }
  return result
}

function advanceAsteroids(room) {
  const active = [...room.values()].filter(player => player.state.scene === 'asteroids')
  if (!active.length) { room.asteroids = null; return null }
  if (!room.asteroids) {
    room.asteroids = createGame()
    room.lastAsteroidsTick = Date.now()
  }
  const game = room.asteroids
  const ids = new Set(active.map(player => player.id))
  for (const ship of game.snapshot().ships) {
    if (!ids.has(ship.id)) game.removePlayer(ship.id)
  }
  for (const player of active) {
    game.addPlayer(player.id, player.state.appearance.name)
    game.setInput(player.id, Date.now() - player.seen < 1000 ? player.state.asteroidsInput : { start: player.state.asteroidsInput?.start || 0 })
  }
  let elapsed = Math.max(0, Math.min(.25, (Date.now() - room.lastAsteroidsTick) / 1000))
  room.lastAsteroidsTick = Date.now()
  while (elapsed > 0) {
    const step = Math.min(1 / 60, elapsed)
    game.step(step)
    elapsed -= step
  }
  return game.snapshot()
}

function createRooms() {
  const rooms = new Map()
  function prune() {
    const now = Date.now()
    for (const [code, room] of rooms) {
      for (const [token, player] of room) {
        if (now - player.seen > IDLE_MS) room.delete(token)
      }
      if (!room.size) rooms.delete(code)
    }
  }
  function reply(response, status, data) {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    response.end(JSON.stringify(data))
  }
  return async function handleRooms(request, response, pathname) {
    if (!pathname.startsWith('/api/')) return false
    if (!['/api/rooms', '/api/join', '/api/sync', '/api/leave'].includes(pathname)) {
      reply(response, 404, { error: 'Unknown endpoint.' })
      return true
    }
    if (request.method !== 'POST') {
      reply(response, 405, { error: 'Use POST.' })
      return true
    }
    // JSON requests stay on the game's own origin, including behind an HTTPS proxy.
    const origin = request.headers.origin
    if (origin) {
      let originHost
      try { originHost = new URL(origin).host } catch { originHost = '' }
      if (originHost !== request.headers.host) {
        reply(response, 403, { error: 'Use the game website to join.' })
        return true
      }
    }
    let body
    try {
      let size = 0
      const chunks = []
      for await (const chunk of request) {
        size += chunk.length
        if (size > 4096) {
          reply(response, 413, { error: 'Request too large.' })
          return true
        }
        chunks.push(chunk)
      }
      body = JSON.parse(Buffer.concat(chunks).toString())
      if (!body || typeof body !== 'object') throw Error('Invalid body')
    } catch {
      reply(response, 400, { error: 'Invalid request.' })
      return true
    }
    prune()
    let code = typeof body.code === 'string' ? body.code.toUpperCase() : ''
    let room = rooms.get(code)
    if (pathname === '/api/leave' || pathname === '/api/sync') {
      const player = room?.get(body.token)
      if (!player) {
        reply(response, 410, { error: 'Your room session expired. Join again.' })
        return true
      }
      if (pathname === '/api/leave') {
        room.delete(body.token)
        advanceAsteroids(room)
        if (!room.size) rooms.delete(code)
        reply(response, 200, { ok: true })
        return true
      }
      const state = cleanState(body.state)
      if (!state) {
        reply(response, 400, { error: 'Invalid player state.' })
        return true
      }
      player.state = state
      player.seen = Date.now()
      const asteroids = advanceAsteroids(room)
      const players = [...room.values()].map(p => ({ id: p.id, ...p.state }))
      reply(response, 200, { players, asteroids: player.state.scene === 'asteroids' ? asteroids : undefined })
      return true
    }
    const state = cleanState(body.state)
    if (!state) {
      reply(response, 400, { error: 'Invalid character.' })
      return true
    }
    if (pathname === '/api/rooms') {
      if (rooms.size >= 100) {
        reply(response, 503, { error: 'Rooms are busy. Please try again later.' })
        return true
      }
      do { code = randomBytes(4).toString('hex').toUpperCase() } while (rooms.has(code))
      room = new Map()
      rooms.set(code, room)
    }
    if (!room) {
      reply(response, 404, { error: 'Room not found. Check the code with your friend.' })
      return true
    }
    if (room.size >= MAX_PLAYERS) {
      reply(response, 409, { error: 'This room is full (8 players).' })
      return true
    }
    const token = randomBytes(24).toString('hex')
    const id = randomBytes(8).toString('hex')
    room.set(token, { id, seen: Date.now(), state })
    reply(response, 200, { code, token, id, inviteBase: process.env.PUBLIC_URL || null })
    return true
  }
}

module.exports = { createRooms }
