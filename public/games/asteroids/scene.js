/* Observatory interior and Asteroids presentation. Gameplay runs through the shared engine. */
window.AsteroidsGame = (() => {
  const plugin = HubGames.find(game => game.manifest.id === 'asteroids-by-siddhant')
  let localGame = null
  let snapshot = null
  let myId = 'solo'
  let online = false
  let sequence = 0
  let rewarded = -1
  let lastShotSound = 0
  let lastScore = 0
  let lastLives = 3
  let received = 0
  let best = 0
  try { best = Number(localStorage.getItem('retro-hub-asteroids-best')) || 0 } catch {}

  function input() {
    return {
      left: !!(keys.KeyA || keys.ArrowLeft),
      right: !!(keys.KeyD || keys.ArrowRight),
      thrust: !!(keys.KeyW || keys.ArrowUp),
      fire: !!keys.Space,
      start: sequence
    }
  }
  function reward(state) {
    if (state.phase !== 'over' || state.round === rewarded) return
    rewarded = state.round
    const ownScore = state.ships.find(ship => ship.id === myId)?.score || 0
    const earned = Math.min(50, Math.floor(ownScore / 100))
    coins += earned
    best = Math.max(best, state.score)
    try { localStorage.setItem('retro-hub-asteroids-best', best) } catch {}
    if (earned) say('ASTEROIDS +' + earned + ' COINS')
  }
  function start() {
    online = !!window.retroFriends?.isConnected()
    document.querySelector('#room-badge').hidden = true
    sequence = 0
    rewarded = -1
    lastScore = 0
    lastLives = 3
    snapshot = null
    received = 0
    if (!online) {
      myId = 'solo'
      localGame = AsteroidsEngine.createGame()
      localGame.addPlayer(myId, cfg.name)
      snapshot = localGame.snapshot()
    }
    for (const key in keys) keys[key] = 0
  }
  function key(code) {
    if (code === 'Escape') {
      scene = 'asteroids-lobby'
      document.querySelector('#room-badge').hidden = !window.retroFriends?.isConnected()
      P.x = 160
      P.y = 98
      P.vx = P.vy = 0
      nearT = null
      snapshot = null
      localGame = null
      fade = 1
      for (const key in keys) keys[key] = 0
    } else if (['Space', 'Enter', 'KeyE'].includes(code)) sequence++
  }
  function receive(state, id) {
    if (!online || scene !== 'asteroids') return
    myId = id
    snapshot = state
    received = performance.now()
    if (state) reward(state)
  }
  function update(dt) {
    if (!online && localGame) {
      localGame.setInput(myId, input())
      localGame.step(dt)
      snapshot = localGame.snapshot()
      reward(snapshot)
    }
    const own = snapshot?.ships.find(ship => ship.id === myId)
    if (own && snapshot.phase === 'play') {
      if (snapshot.score > lastScore) beep(100, .08, 'sawtooth', .03, 55)
      if (own.lives < lastLives) beep(160, .35, 'sawtooth', .05, 45)
      if (input().fire && own.lives > 0 && own.respawn <= 0 && T - lastShotSound > .16) {
        beep(900, .05, 'square', .02, 380)
        lastShotSound = T
      }
      lastLives = own.lives
      lastScore = snapshot.score
    }
  }

  function line(x0, y0, x1, y1, color) {
    g.strokeStyle = color
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(Math.round(x0) + .5, Math.round(y0) + .5)
    g.lineTo(Math.round(x1) + .5, Math.round(y1) + .5)
    g.stroke()
  }
  function centered(text, y, color = K.tx, scale = 1) {
    txt(text, VW / 2 - tw(text, scale) / 2, y, color, scale, 1)
  }
  function shipDrawing(ship) {
    const x = 16 + ship.x, y = 14 + ship.y, angle = ship.angle
    const nose = [x + Math.cos(angle) * 7, y + Math.sin(angle) * 7]
    const left = [x + Math.cos(angle + 2.5) * 6, y + Math.sin(angle + 2.5) * 6]
    const right = [x + Math.cos(angle - 2.5) * 6, y + Math.sin(angle - 2.5) * 6]
    line(...nose, ...left, ship.color)
    line(...left, x - Math.cos(angle) * 2, y - Math.sin(angle) * 2, ship.color)
    line(x - Math.cos(angle) * 2, y - Math.sin(angle) * 2, ...right, ship.color)
    line(...right, ...nose, ship.color)
    if (ship.thrust && Math.floor(T * 20) % 2) {
      line(x - Math.cos(angle) * 3, y - Math.sin(angle) * 3, x - Math.cos(angle) * 11, y - Math.sin(angle) * 11, '#ffd45e')
    }
    if (ship.id === myId) {
      txt('YOU', x - 6, y - 14, ship.color)
    } else {
      txt(ship.name, x - tw(ship.name) / 2, y - 14, ship.color)
    }
  }
  function draw() {
    g.fillStyle = '#070c14'
    g.fillRect(0, 0, VW, VH)
    box(4, 2, 312, 176)
    px('#04120c', 16, 14, 288, 148)
    for (let i = 0; i < 45; i++) {
      px(i % 3 ? '#19382f' : '#406956', 18 + i * 67 % 282, 18 + i * 41 % 139, 1, 1)
    }
    const state = snapshot
    if (!state) {
      centered(online ? 'CONNECTING TO YOUR SQUAD...' : 'LOADING...', 82, K.gold)
      centered('ESC RETURN TO OBSERVATORY', 112)
      return
    }
    g.save()
    g.beginPath()
    g.rect(16, 14, 288, 148)
    g.clip()
    for (const rock of state.rocks) {
      const vertices = rock.shape.map((radius, index) => {
        const angle = rock.angle + index / rock.shape.length * Math.PI * 2
        return [16 + rock.x + Math.cos(angle) * rock.radius * radius, 14 + rock.y + Math.sin(angle) * rock.radius * radius]
      })
      for (let i = 0; i < vertices.length; i++) line(...vertices[i], ...vertices[(i + 1) % vertices.length], '#67d9a4')
    }
    for (const bullet of state.bullets) px(bullet.color, 16 + bullet.x, 14 + bullet.y, 2, 2)
    for (const spark of state.sparks) {
      g.globalAlpha = Math.min(1, spark.life * 3)
      px(spark.color, 16 + spark.x, 14 + spark.y, 1, 1)
    }
    g.globalAlpha = 1
    for (const ship of state.ships) {
      if (state.phase !== 'play' || ship.lives <= 0 || ship.respawn > 0) continue
      if (ship.shield > 0) {
        g.strokeStyle = ship.color
        g.globalAlpha = .25 + .2 * Math.sin(state.time * 8)
        g.beginPath()
        g.arc(16 + ship.x, 14 + ship.y, 11, 0, Math.PI * 2)
        g.stroke()
        g.globalAlpha = 1
      }
      shipDrawing(ship)
    }
    g.restore()
    txt('TEAM ' + state.score, 12, 6, K.tx)
    txt('WAVE ' + state.wave, 138, 6, K.gold)
    const own = state.ships.find(ship => ship.id === myId)
    txt('LIVES ' + (own?.lives || 0), 245, 6, own?.color || K.tx)
    txt('A D ROTATE  W THRUST  SPACE FIRE  ESC EXIT', 16, 169, K.tx)
    if (state.phase === 'ready') {
      centered('ASTEROIDS', 46, '#7affc8', 3)
      centered(online ? 'CO-OP SQUAD - ' + state.ships.length + ' PILOTS' : 'SOLO FLIGHT', 80, K.gold)
      centered('SPACE TO LAUNCH', 103)
      centered('3 LIVES - BONUS LIFE EVERY 2000', 121, '#a2b6ad')
    } else if (state.phase === 'over') {
      box(48, 45, 224, 90)
      centered('MISSION OVER', 54, '#ff9acb', 2)
      centered('TEAM ' + state.score + '  BEST ' + Math.max(best, state.score), 78, K.gold)
      centered('YOUR SCORE ' + (own?.score || 0), 92, own?.color || K.tx)
      centered('SPACE TO RESTART TOGETHER', 117)
    } else if (own && own.lives <= 0) {
      centered('OUT OF LIVES - CHEER ON YOUR SQUAD', 140, K.gold)
    } else if (own?.respawn > 0) centered('RESPAWNING...', 90, own.color)
    else if (!state.rocks.length) centered('WAVE CLEAR', 90, K.gold)
    if (online && (performance.now() - received > 3000 || !window.retroFriends?.isConnected())) {
      box(36, 72, 248, 30)
      centered('CONNECTION LOST - RECONNECTING', 78, K.gold)
      centered('ESC RETURN TO OBSERVATORY', 91)
    }
  }

  function drawInterior() {
    g.fillStyle = '#080d1c'
    g.fillRect(0, 0, VW, VH)
    // Observatory window, brass telescope, star charts, and a central green cabinet.
    for (let y = 58; y < 170; y += 8) {
      for (let x = 40; x < 280; x += 8) {
        px((x + y) % 16 ? '#25344b' : '#2d4054', x, y, 8, 8)
        px('#364a5b', x, y, 8, 1)
      }
    }
    px('#141b32', 40, 10, 240, 48)
    px('#71819b', 42, 54, 236, 3)
    box(60, 23, 61, 29)
    px('#090f29', 63, 26, 55, 22)
    for (let i = 0; i < 15; i++) px(i % 3 ? '#9cb2d2' : '#ffd45e', 65 + i * 13 % 49, 28 + i * 7 % 18, 1, 1)
    px('#6378ad', 89, 31, 10, 9)
    px('#c6b4db', 89, 31, 7, 3)
    centered('ORBIT OBSERVATORY', 12, '#7affc8', 2)
    box(199, 25, 60, 27)
    txt('FLIGHT PLAN', 208, 30, K.gold)
    line(208, 44, 220, 37, '#7ad8ff')
    line(220, 37, 236, 45, '#7ad8ff')
    line(236, 45, 250, 37, '#7ad8ff')
    px('#b83a3a', 144, 162, 32, 8)
    txt('EXIT', 152, 164, K.tx)
    const items = [
      [64, () => {
        cab(160, 64, '#4bcfa5', 1)
        px('#051c17', 152, 34, 16, 12)
        line(156, 37, 160, 43, '#7affc8')
        line(160, 43, 165, 37, '#7affc8')
        txt('ASTEROIDS', 143, 23, '#7affc8')
      }],
      [94, () => {
        line(85, 77, 74, 94, '#a28b6c')
        line(85, 77, 96, 94, '#a28b6c')
        px('#a5bfd3', 76, 68, 22, 5)
        px('#dbd3ab', 77, 68, 3, 6)
        px('#6d87a2', 95, 66, 4, 8)
      }],
      [118, () => {
        box(224, 98, 37, 20)
        txt('PILOT', 231, 103, K.gold)
        txt('READY', 231, 111, '#7affc8')
      }],
      [P.y, () => {
        drawChar(g, P.x, P.y, P.dir, P.fr, cfg)
        txt(cfg.name, P.x - tw(cfg.name) / 2, P.y - 39, K.tx, 1, 1)
      }]
    ]
    window.retroFriends?.addPlayers(items, 'asteroids-lobby', 0, 0)
    items.sort((a, b) => a[0] - b[0])
    for (const [, drawItem] of items) drawItem()
    g.fillStyle = 'rgba(100,255,200,.08)'
    g.fillRect(145, 66, 30, 78)
    hud(0, 0, 0)
    if (fade > 0) {
      g.fillStyle = 'rgba(10,6,24,' + fade + ')'
      g.fillRect(0, 0, VW, VH)
    }
  }
  return { building: plugin.building, start, key, input, receive, update, draw, drawInterior }
})()
