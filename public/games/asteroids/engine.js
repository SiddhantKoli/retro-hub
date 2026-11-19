(function (root) {
  'use strict'
  const WIDTH = 288
  const HEIGHT = 148
  const COLORS = ['#b8ffd0', '#7ad8ff', '#ff9acb', '#ffd45e', '#c6a4ff', '#ffa571', '#f4ecd8', '#64e6dc']
  const wrap = (value, size) => (value % size + size) % size
  function distance(a, b) {
    const dx = Math.min(Math.abs(a.x - b.x), WIDTH - Math.abs(a.x - b.x))
    const dy = Math.min(Math.abs(a.y - b.y), HEIGHT - Math.abs(a.y - b.y))
    return Math.hypot(dx, dy)
  }

  function createGame(random = Math.random) {
    let state = { phase: 'ready', round: 0, wave: 1, score: 0, time: 0, waveDelay: 0, ships: [], rocks: [], bullets: [], sparks: [] }
    const inputs = new Map()
    let nextId = 0

    function shipPosition(index) {
      return { x: WIDTH / 2 + Math.cos(index * 2.4) * 22, y: HEIGHT / 2 + Math.sin(index * 2.4) * 22 }
    }
    function resetShip(ship, index) {
      Object.assign(ship, shipPosition(index), { vx: 0, vy: 0, angle: -Math.PI / 2, cooldown: 0, shield: 3, respawn: 0, thrust: false })
    }
    function addPlayer(id, name) {
      let ship = state.ships.find(item => item.id === id)
      if (ship) { ship.name = name; return }
      ship = { id, name, color: COLORS[state.ships.length % COLORS.length], lives: 3, score: 0, nextLife: 2000, startSequence: 0 }
      resetShip(ship, state.ships.length)
      state.ships.push(ship)
    }
    function removePlayer(id) {
      state.ships = state.ships.filter(ship => ship.id !== id)
      state.bullets = state.bullets.filter(bullet => bullet.owner !== id)
      inputs.delete(id)
    }
    function rock(x, y, size, vx, vy) {
      return {
        id: ++nextId, x, y, size, radius: [0, 4, 8, 14][size], vx, vy,
        angle: random() * Math.PI * 2, spin: (random() - .5) * 1.6,
        shape: Array.from({length: 9}, () => .72 + random() * .46)
      }
    }
    function spawnWave() {
      const count = Math.min(9, 3 + state.wave)
      for (let i = 0; i < count; i++) {
        // Spawn on the outer edge, away from the central respawn area.
        const x = random() * WIDTH
        const y = random() < .5 ? 8 : HEIGHT - 8
        const angle = random() * Math.PI * 2
        const speed = Math.min(90, 17 + random() * 10 + state.wave * 2.5)
        state.rocks.push(rock(x, y, 3, Math.cos(angle) * speed, Math.sin(angle) * speed))
      }
    }
    function startRound() {
      state.phase = 'play'
      state.round++
      state.wave = 1
      state.score = 0
      state.waveDelay = 0
      state.rocks = []
      state.bullets = []
      state.sparks = []
      for (const [index, ship] of state.ships.entries()) {
        ship.lives = 3
        ship.score = 0
        ship.nextLife = 2000
        resetShip(ship, index)
      }
      spawnWave()
    }
    function particles(x, y, color, count) {
      for (let i = 0; i < count; i++) {
        const angle = random() * Math.PI * 2
        const speed = 15 + random() * 60
        state.sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .25 + random() * .45, color })
      }
      if (state.sparks.length > 240) state.sparks.splice(0, state.sparks.length - 240)
    }
    function hitRock(target, bullet) {
      const points = [0, 100, 50, 20][target.size]
      state.score += points
      const ship = state.ships.find(item => item.id === bullet.owner)
      if (ship) {
        ship.score += points
        if (ship.score >= ship.nextLife) {
          ship.lives = Math.min(5, ship.lives + 1)
          ship.nextLife += 2000
        }
      }
      particles(target.x, target.y, '#ffd45e', 9)
      state.rocks = state.rocks.filter(item => item.id !== target.id)
      if (target.size > 1) {
        for (let i = 0; i < 2; i++) {
          const angle = random() * Math.PI * 2
          const speed = 25 + random() * 24
          state.rocks.push(rock(target.x, target.y, target.size - 1,
            target.vx * .4 + Math.cos(angle) * speed, target.vy * .4 + Math.sin(angle) * speed))
        }
      }
    }
    function moveShip(ship, dt) {
      const input = inputs.get(ship.id) || {}
      ship.shield = Math.max(0, ship.shield - dt)
      ship.cooldown -= dt
      if (ship.respawn > 0) {
        ship.respawn -= dt
        if (ship.respawn <= 0 && ship.lives > 0) resetShip(ship, state.ships.indexOf(ship))
        return
      }
      if (ship.lives <= 0) return
      ship.angle += ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * 3.8 * dt
      ship.thrust = !!input.thrust
      if (ship.thrust) {
        ship.vx += Math.cos(ship.angle) * 130 * dt
        ship.vy += Math.sin(ship.angle) * 130 * dt
      }
      const speed = Math.hypot(ship.vx, ship.vy)
      const damping = Math.pow(.8, dt) * (speed > 150 ? 150 / speed : 1)
      ship.vx *= damping
      ship.vy *= damping
      ship.x = wrap(ship.x + ship.vx * dt, WIDTH)
      ship.y = wrap(ship.y + ship.vy * dt, HEIGHT)
      if (input.fire && ship.cooldown <= 0 && state.bullets.filter(item => item.owner === ship.id).length < 6) {
        state.bullets.push({
          owner: ship.id, color: ship.color,
          x: wrap(ship.x + Math.cos(ship.angle) * 7, WIDTH),
          y: wrap(ship.y + Math.sin(ship.angle) * 7, HEIGHT),
          vx: ship.vx + Math.cos(ship.angle) * 230, vy: ship.vy + Math.sin(ship.angle) * 230,
          life: .9
        })
        ship.cooldown = .16
      }
      if (ship.shield <= 0 && state.rocks.some(item => distance(ship, item) < item.radius * .85 + 3)) {
        particles(ship.x, ship.y, ship.color, 18)
        ship.lives--
        ship.respawn = 1.6
        ship.thrust = false
      }
    }
    function step(dt) {
      dt = Math.max(0, Math.min(dt || 0, .05))
      state.time += dt
      let start = false
      for (const ship of state.ships) {
        const sequence = inputs.get(ship.id)?.start || 0
        if (sequence !== ship.startSequence) {
          ship.startSequence = sequence
          start = true
        }
      }
      if (start && state.ships.length && state.phase !== 'play') startRound()
      if (state.phase !== 'play') return
      for (const target of state.rocks) {
        target.x = wrap(target.x + target.vx * dt, WIDTH)
        target.y = wrap(target.y + target.vy * dt, HEIGHT)
        target.angle += target.spin * dt
      }
      for (const ship of state.ships) moveShip(ship, dt)
      for (const bullet of state.bullets) {
        bullet.x = wrap(bullet.x + bullet.vx * dt, WIDTH)
        bullet.y = wrap(bullet.y + bullet.vy * dt, HEIGHT)
        bullet.life -= dt
        if (bullet.life <= 0) continue
        const target = state.rocks.find(item => distance(bullet, item) < item.radius * .9 + 1)
        if (target) { hitRock(target, bullet); bullet.life = 0 }
      }
      state.bullets = state.bullets.filter(item => item.life > 0)
      for (const spark of state.sparks) {
        spark.x += spark.vx * dt
        spark.y += spark.vy * dt
        spark.life -= dt
      }
      state.sparks = state.sparks.filter(item => item.life > 0)
      if (!state.ships.some(ship => ship.lives > 0 || ship.respawn > 0)) state.phase = 'over'
      if (!state.rocks.length && state.phase === 'play') {
        state.waveDelay += dt
        if (state.waveDelay >= 1.6) {
          state.wave++
          state.waveDelay = 0
          for (const ship of state.ships) ship.shield = Math.max(1.5, ship.shield)
          spawnWave()
        }
      }
    }
    return {
      addPlayer, removePlayer, step,
      setInput(id, input) { inputs.set(id, input) },
      snapshot() { return JSON.parse(JSON.stringify(state)) }
    }
  }
  const engine = { createGame, WIDTH, HEIGHT }
  if (typeof module !== 'undefined' && module.exports) module.exports = engine
  else root.AsteroidsEngine = engine
})(globalThis)
