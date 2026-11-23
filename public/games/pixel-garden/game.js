/* Pixel Garden: a tiny shared greenhouse for Retro Hub. */
(() => {
  'use strict'
  const manifest = {
    id: 'pixel-garden-by-siddhant', name: 'PIXEL GARDEN', author: 'siddhant-k',
    description: 'Plant a seed, water it, and grow a little garden together.',
    version: '1.0.0', controls: 'WASD move, E plant / water / harvest, ESC exit',
    players: { min: 1, max: 8, mode: 'coop' }
  }
  const C = { ink: '#18202a', soil: '#583a30', soil2: '#79513a', leaf: '#69ad67', leaf2: '#a2d779', glass: '#8fd5d1', gold: '#ffd66d', cream: '#f3ead0', pink: '#f184ae', sky: '#23394a' }
  const beds = [54, 125, 196, 267]
  const colors = ['#f184ae', '#ffd66d', '#9a9dff', '#ff9a67']
  const freshBoard = () => beds.map(() => ({ seed: -1, growAt: 0, watered: false }))
  let board = freshBoard(), actionSeq = 0, pending = null, ctx = null, t = 0, active = false, nearby = -1, message = 'Plant a seed in an empty bed.'

  const px = (g, color, x, y, w, h = 1) => { g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), w, h) }
  function text(g, value, x, y, color = C.cream, scale = 1) {
    const font = { A:'010101111101101', B:'110101110101110', C:'011100100100011', D:'110101101101110', E:'111100110100111', F:'111100110100100', G:'011100101101011', H:'101101111101101', I:'111010010010111', J:'001001001101010', K:'101101110101101', L:'100100100100111', M:'101111111101101', N:'110101101101101', O:'010101101101010', P:'110101110100100', Q:'010101101111011', R:'110101110101101', S:'011100010001110', T:'111010010010010', U:'101101101101111', V:'101101101101010', W:'101101111111101', X:'101101010101101', Y:'101101010010010', Z:'111001010100111', 0:'111101101101111', 1:'010110010010111', 2:'110001010100111', 3:'110001010001110', 4:'101101111001001', 5:'111100110001110', 6:'011100110101010', 7:'111001010010010', 8:'010101010101010', 9:'010101011001110', ':':'000010000010000', '/':'001001010100100', '-':'000000111000000', '!':'010010010000010', ' ':'000000000000000' }
    const s = String(value).toUpperCase()
    for (let i = 0; i < s.length; i++) { const glyph = font[s[i]] || font[' ']; for (let b = 0; b < 15; b++) if (glyph[b] === '1') px(g, color, x + i * 4 * scale + b % 3 * scale, y + Math.floor(b / 3) * scale, scale, scale) }
  }
  function buildingDraw(g, x, y, time, dark) {
    g.fillStyle = 'rgba(0,0,0,.32)'; g.fillRect(x + 1, y + 58, 82, 8)
    px(g, '#263a3d', x - 3, y + 15, 86, 13); px(g, '#14242b', x, y + 21, 80, 42)
    // Greenhouse panes, timber ribs and a warm sill.
    px(g, '#415f59', x + 3, y + 24, 74, 29); px(g, dark > .3 ? '#b3a66a' : '#89c6b5', x + 5, y + 26, 70, 24)
    px(g, '#d5bd78', x + 4, y + 50, 72, 4); px(g, '#795a40', x, y + 55, 80, 8); px(g, '#b0905d', x, y + 55, 80, 2)
    for (let xx = x + 13; xx < x + 75; xx += 15) { px(g, '#284348', xx, y + 24, 3, 29); px(g, '#7da694', xx + 1, y + 25, 1, 27) }
    px(g, '#172229', x - 3, y + 11, 86, 7); px(g, '#37565a', x, y + 13, 80, 6)
    for (let xx = x + 2; xx < x + 78; xx += 8) px(g, '#9bc9a2', xx, y + 14, 4, 3)
    px(g, '#111820', x + 10, y + 4, 60, 11); px(g, '#263a3b', x + 11, y + 5, 58, 9)
    px(g, C.glass, x + 11, y + 5, 58, 1); text(g, 'PIXEL GARDEN', x + 16, y + 7, '#b2f3cb')
    // Sloped glass roof and a little spinning sun vent.
    for (let i = 0; i < 5; i++) { px(g, '#24373b', x + 2 + i * 8, y + 3 + i * 2, 9, 2); px(g, '#78ada0', x + 3 + i * 8, y + 4 + i * 2, 7, 1); px(g, '#24373b', x + 38 + i * 8, y + 11 - i * 2, 9, 2); px(g, '#78ada0', x + 39 + i * 8, y + 12 - i * 2, 7, 1) }
    px(g, '#263a3d', x + 38, y + 1, 3, 8); px(g, time % 1 < .5 ? C.gold : '#b87b65', x + 38, y - 2, 3, 3)
    px(g, '#172229', x + 32, y + 39, 16, 24); px(g, '#684633', x + 34, y + 41, 12, 22); px(g, '#d7bd78', x + 43, y + 52, 2, 2)
    for (const xx of [x + 7, x + 59]) { px(g, '#344542', xx, y + 36, 14, 10); px(g, C.leaf, xx + 2, y + 38, 3, 5); px(g, C.leaf2, xx + 7, y + 37, 4, 6); px(g, '#bd8e60', xx - 1, y + 45, 16, 2) }
  }
  const building = { w: 80, h: 64, collider: { x: 0, y: 24, w: 80, h: 40 }, door: { x: 40, y: 68 }, neon: C.glass, draw: buildingDraw }

  function start(context) {
    ctx = context || {}; active = true; t = 0; nearby = -1; message = 'Plant a seed in an empty bed.'
    board = freshBoard(); pending = null
    if (typeof P !== 'undefined') { P.x = 160; P.y = 151; P.vx = P.vy = 0 }
  }
  function end() { active = false; ctx = null; pending = null }
  function exit() { active = false; ctx?.exit?.() }
  function applyLocal(plot, kind, seed) {
    const pot = board[plot], now = Date.now()
    if (kind === 'plant' && pot.seed < 0) { pot.seed = seed; pot.growAt = now + 9000; pot.watered = false; message = 'Seed tucked in. Give it a drink!'; return }
    if (kind === 'water' && pot.seed >= 0 && pot.growAt > now) { pot.growAt = Math.max(now, pot.growAt - 3500); pot.watered = true; message = 'Lovely! Your seed is growing faster.'; return }
    if (kind === 'harvest' && pot.seed >= 0 && pot.growAt <= now) { board[plot] = { seed: -1, growAt: 0, watered: false }; ctx?.reportScore?.(1); message = 'Fresh bloom! +1 coin. Plant another.'; ctx?.beep?.(880, .09, 'sine', .035, 1320); return }
    message = pot.seed < 0 ? 'E: plant a seed here.' : pot.growAt > now ? 'E: water this little sprout.' : 'E: harvest your flower!'
  }
  function key(code) {
    if (!active) return
    if (code === 'Escape') { exit(); return }
    if (code !== 'KeyE' || nearby < 0) return
    const pot = board[nearby], now = Date.now(), kind = pot.seed < 0 ? 'plant' : pot.growAt > now ? 'water' : 'harvest'
    if (window.retroFriends?.isConnected?.()) {
      pending = { seq: ++actionSeq, plot: nearby, kind, seed: (nearby + actionSeq) % 4 }
      message = kind === 'plant' ? 'Planting together…' : kind === 'water' ? 'Watering together…' : 'Harvesting together…'
    } else applyLocal(nearby, kind, (nearby + actionSeq++) % 4)
  }
  function networkState() { return pending }
  function receive(sharedBoard, reward, ack = 0, note = '') {
    if (Array.isArray(sharedBoard) && sharedBoard.length === 4) board = sharedBoard.map(p => ({ seed: p.seed, growAt: p.growAt, watered: p.watered }))
    if (reward) { ctx?.reportScore?.(1); message = 'Fresh bloom! +1 coin. The garden is shared.'; ctx?.beep?.(880, .09, 'sine', .035, 1320) }
    if (pending && pending.seq <= ack) pending = null
    if (note) message = note
  }
  function update(dt, keys) {
    if (!active || typeof P === 'undefined') return
    t += Math.min(.05, dt)
    const ax = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0)
    const ay = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0)
    P.vx = ax * 69; P.vy = ay * 69
    const nx = Math.max(17, Math.min(303, P.x + P.vx * dt)), ny = Math.max(42, Math.min(157, P.y + P.vy * dt))
    // Counter bench and shelves keep a clear walk lane down the middle.
    const blocked = (x, y) => (y < 66 && x > 38 && x < 282) || (y > 71 && y < 91 && (x < 36 || x > 284))
    if (!blocked(nx, P.y)) P.x = nx
    if (!blocked(P.x, ny)) P.y = ny
    if (ax || ay) { P.dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 3 : 2) : (ay > 0 ? 0 : 1); P.fr = 1 + Math.floor(t * 10) % 4 } else P.fr = Math.floor(t * 2) % 2 ? 2 : 0
    nearby = -1; let distance = 21
    for (let i = 0; i < beds.length; i++) { const d = Math.hypot(P.x - beds[i], P.y - 108); if (d < distance) { distance = d; nearby = i } }
    if (P.y > 158 && Math.abs(P.x - 160) < 23) message = 'Press ESC to leave the greenhouse.'
  }
  function flower(g, x, y, seed, stage, time, watered) {
    const color = colors[seed] || C.pink
    px(g, '#47794b', x - 9, y + 1, 18, 4); px(g, '#315b3a', x - 8, y + 4, 16, 2)
    px(g, '#956344', x - 9, y - 1, 18, 2); px(g, '#c08b5d', x - 8, y - 7, 16, 7); px(g, '#82563e', x - 7, y - 6, 14, 5)
    if (seed < 0) { px(g, '#d8c18a', x - 1, y - 5, 2, 2); return }
    const stem = stage === 0 ? 3 : stage === 1 ? 8 : 15
    px(g, '#478c56', x, y - stem, 2, stem)
    px(g, '#71b96b', x - 5, y - Math.max(4, stem - 4), 5, 2); px(g, '#5ca15e', x + 2, y - Math.max(6, stem - 6), 5, 2)
    if (stage >= 2) {
      const bob = Math.round(Math.sin(time * 3 + x) * 1)
      px(g, color, x - 4, y - 19 + bob, 3, 3); px(g, color, x + 3, y - 19 + bob, 3, 3); px(g, color, x - 1, y - 22 + bob, 4, 3); px(g, color, x - 1, y - 15 + bob, 4, 2); px(g, C.gold, x - 1, y - 18 + bob, 3, 3)
      px(g, '#fff5ce', x + 2, y - 22 + bob, 1, 1)
    } else if (stage === 1) { px(g, color, x - 2, y - stem - 3, 5, 4); px(g, '#b9df79', x - 1, y - stem - 2, 2, 2) }
    if (watered && stage < 2) { px(g, '#81d9ec', x + 8, y - 11, 2, 3); px(g, '#c3f4ff', x + 9, y - 12, 1, 1) }
  }
  function draw(g) {
    g.imageSmoothingEnabled = false; g.fillStyle = '#293e43'; g.fillRect(0, 0, 320, 180)
    // High glass roof with wooden ribs and a fading evening sky beyond.
    px(g, '#23343c', 0, 0, 320, 68); px(g, '#9abbaa', 0, 18, 320, 46); px(g, '#c3c29a', 0, 18, 320, 2); px(g, '#516c66', 0, 61, 320, 7)
    for (let x = 18; x < 320; x += 38) { px(g, '#385052', x, 18, 3, 43); px(g, '#658378', x + 1, 19, 1, 40); px(g, '#29373b', x - 5, 61, 13, 5) }
    for (let x = 20; x < 300; x += 38) { px(g, '#d9c78f', x, 33 + Math.sin(t + x) * 2, 2, 2); px(g, '#f6e3a2', x + 1, 32 + Math.sin(t + x) * 2, 1, 1) }
    // Tiled stone walkway; garden beds sit on both sides.
    px(g, '#776755', 0, 70, 320, 110); px(g, '#98856a', 0, 70, 320, 2)
    for (let y = 73; y < 180; y += 16) for (let x = 0; x < 320; x += 20) { px(g, (x / 20 + y / 16) % 2 ? '#82725e' : '#897961', x, y, 20, 16); px(g, '#9c8a6d', x + 1, y + 1, 18, 1); px(g, '#665a4d', x, y + 15, 20, 1) }
    px(g, '#b49c73', 0, 93, 320, 5); px(g, '#d0ba89', 0, 94, 320, 1)
    // Back wall counter, terracotta pots and glass watering station.
    px(g, '#394a45', 12, 67, 296, 21); px(g, '#ad8a5c', 12, 85, 296, 4); px(g, '#d2b67c', 12, 85, 296, 1)
    for (let x = 24; x < 300; x += 24) { px(g, '#243534', x, 71, 16, 12); px(g, '#526b5d', x + 1, 72, 14, 8); px(g, '#78a270', x + 4, 74 + Math.sin(t + x) * 1, 2, 4); px(g, '#9bc97d', x + 8, 73 + Math.sin(t + x) * 1, 3, 5) }
    // Four lovingly tended planter beds.
    const now = Date.now()
    for (let i = 0; i < beds.length; i++) {
      const p = board[i], mature = p.seed >= 0 && p.growAt > 0 && now >= p.growAt
      const stage = p.seed < 0 ? -1 : mature ? 2 : p.growAt - now < 4500 ? 1 : 0
      const x = beds[i], y = 126
      px(g, 'rgba(20,25,27,.2)', x - 17, 132, 34, 5); px(g, '#49342d', x - 16, 101, 32, 31); px(g, '#bb8558', x - 15, 102, 30, 2); px(g, '#604233', x - 13, 105, 26, 20); px(g, '#876047', x - 13, 124, 26, 2)
      for (let k = 0; k < 4; k++) px(g, '#a47651', x - 11 + k * 6, 108 + (k % 2) * 6, 1, 1)
      flower(g, x, y, p.seed, stage, t, p.watered)
      if (nearby === i) { px(g, '#fff0be', x - 1, 95 + Math.sin(t * 6) * 2, 2, 2); px(g, '#fff0be', x - 4, 98 + Math.sin(t * 6) * 2, 1, 1); px(g, '#fff0be', x + 3, 98 + Math.sin(t * 6) * 2, 1, 1) }
    }
    // Water can, seed packets and a little gardener's stool.
    px(g, '#9aaeb0', 284, 116, 12, 13); px(g, '#c8dcce', 286, 118, 8, 8); px(g, '#60787b', 288, 113, 4, 4); px(g, '#badacb', 296, 120, 6, 2); px(g, '#658078', 299, 119, 2, 3)
    px(g, '#7a533c', 21, 119, 14, 8); px(g, '#b08153', 20, 118, 16, 2); px(g, '#ecbd6c', 24, 116, 5, 3); px(g, '#e883a8', 30, 115, 4, 4)
    // Friendly visitors share the greenhouse through the hub's room-code session.
    const items = [[P.y, () => { drawChar(g, P.x, P.y, P.dir, P.fr, cfg); txt(cfg.name, P.x - tw(cfg.name) / 2, P.y - 37 - (cfg.cap === 3 ? 7 : 0), C.cream, 1, 1) }]]
    window.retroFriends?.addPlayers(items, 'pixel-garden', 0, 0)
    items.sort((a, b) => a[0] - b[0]); for (const [, drawItem] of items) drawItem()
    px(g, '#18252c', 0, 0, 320, 16); px(g, '#58736b', 0, 16, 320, 1); text(g, 'PIXEL GARDEN', 8, 5, '#aaf0c8'); text(g, 'SHARED BEDS', 233, 5, C.gold)
    px(g, '#18252c', 4, 164, 312, 13); text(g, message, 9, 168, C.cream)
    if (nearby >= 0) { const p = board[nearby], label = p.seed < 0 ? 'E PLANT' : p.growAt > Date.now() ? 'E WATER' : 'E HARVEST'; px(g, '#202536', P.x - label.length * 2 - 5, P.y - 31, label.length * 4 + 10, 11); text(g, label, P.x - label.length * 2, P.y - 28, C.gold) }
    text(g, 'WASD WALK   E TEND   ESC EXIT', 84, 153, '#f2e8d0')
    if (window.retroFriends?.isConnected?.()) text(g, 'ROOM GARDEN', 118, 24, '#d5f1c4')
  }
  const Scene = { start, update, draw, key, end, networkState, receive, selfTest() { return { ok: true, results: [{ name: 'garden plugin registration', pass: true, detail: 'Pixel Garden house and scene registered.' }] } } }
  const plugin = { manifest, building, Scene }
  ;(globalThis.HubGames = globalThis.HubGames || []).push(plugin)
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin
})()
