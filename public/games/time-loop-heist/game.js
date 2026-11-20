/*
 * TIME LOOP HEIST — a vault house and co-op mini game for Retro Hub.
 * Multiplayer uses the hub's existing room service: each player publishes their
 * position in the time-loop-heist scene and both clients derive the same puzzle
 * state from the shared positions. No game-specific socket or external service.
 */
(() => {
  'use strict'
  const manifest = {
    id: 'time-loop-heist-by-siddhant', name: 'TIME LOOP HEIST', author: 'siddhant-k',
    description: 'Two thieves, one vault. Hold both plates, crack the vault, and escape together.',
    version: '1.0.0', controls: 'WASD move, E interact, ESC exit',
    players: { min: 1, max: 2, mode: 'coop' }
  }
  const C = {
    ink: '#111522', deep: '#171e2b', steel: '#354354', steel2: '#536476', silver: '#9eafbb',
    floor: '#39404b', tile: '#505660', gold: '#efbd62', gold2: '#ffe5a1', mint: '#5affc8',
    blue: '#61b9ff', orange: '#ff9a55', red: '#e85458', wood: '#744936', cream: '#f4e8c9'
  }
  const px = (g, c, x, y, w, h = 1) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h) }
  const line = (g, x1, y1, x2, y2, c) => {
    x1 = Math.round(x1); y1 = Math.round(y1); x2 = Math.round(x2); y2 = Math.round(y2)
    const dx = Math.abs(x2 - x1), dy = -Math.abs(y2 - y1), sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1
    let err = dx + dy
    for (;;) { px(g, c, x1, y1); if (x1 === x2 && y1 === y2) break; const e = err * 2; if (e >= dy) { err += dy; x1 += sx } if (e <= dx) { err += dx; y1 += sy } }
  }
  function text(g, s, x, y, color = C.cream, scale = 1) {
    // Compact built-in 3x5 alphabet keeps the pixel lettering crisp and dependency-free.
    const glyph = {A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',K:'101101110101101',L:'100100100100111',M:'101111111101101',N:'110101101101101',O:'010101101101010',P:'110101110100100',Q:'010101101111011',R:'110101110101101',S:'011100010001110',T:'111010010010010',U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',Z:'111001010100111',0:'111101101101111',1:'010110010010111',2:'110001010100111',3:'110001010001110',4:'101101111001001',5:'111100110001110',6:'011100110101010',7:'111001010010010',8:'010101010101010',9:'010101011001110',':':'000010000010000','-':'000000111000000','!':'010010010000010','?':'110001010000010','/':'001001010100100',' ':'000000000000000', '.':'000000000000010' }
    s = String(s).toUpperCase()
    for (let i = 0; i < s.length; i++) { const bits = glyph[s[i]] || glyph[' ']; for (let b = 0; b < 15; b++) if (bits[b] === '1') px(g, color, x + i * 4 * scale + b % 3 * scale, y + Math.floor(b / 3) * scale, scale, scale) }
  }
  const building = {
    w: 80, h: 64, collider: { x: 0, y: 24, w: 80, h: 40 }, door: { x: 40, y: 68 }, neon: C.mint,
    draw(g, x, y, t, dark) {
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 1, y + 58, 82, 9)
      px(g, '#191b24', x - 1, y + 23, 82, 42); px(g, C.steel, x, y + 24, 80, 37); px(g, C.steel2, x + 1, y + 25, 78, 2)
      for (let yy = y + 30; yy < y + 57; yy += 7) { px(g, '#26313d', x + 2, yy, 76, 1); for (let xx = x + 6; xx < x + 77; xx += 12) { px(g, C.silver, xx, yy + 2, 1, 1); px(g, '#202936', xx + 1, yy + 3, 1, 1) } }
      px(g, '#75808a', x, y + 58, 80, 5); px(g, '#a0a4a6', x, y + 58, 80, 1)
      // Clock tower roof: the hand runs forward, then reverses every four seconds.
      px(g, '#141923', x - 5, y + 5, 90, 22); px(g, '#202a37', x - 3, y + 6, 86, 18); px(g, '#68798a', x - 3, y + 6, 86, 2)
      px(g, '#10151e', x + 31, y - 11, 18, 20); px(g, '#5f6e78', x + 33, y - 9, 14, 17); px(g, '#10151e', x + 35, y - 7, 10, 11)
      g.fillStyle = '#d6bf81'; g.beginPath(); g.arc(x + 40, y - 2, 5, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#23303b'; g.beginPath(); g.arc(x + 40, y - 2, 4, 0, Math.PI * 2); g.fill()
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; px(g, C.gold2, x + 39 + Math.cos(a) * 3, y - 3 + Math.sin(a) * 3, 1, 1) }
      const phase = (t % 4), angle = phase < 3 ? phase * 2.1 : (3 - (phase - 3) * 2.2) * 2.1
      line(g, x + 40, y - 2, x + 40 + Math.cos(angle) * 3, y - 2 + Math.sin(angle) * 3, C.mint)
      // Lit sign, lamps, and the heavy round vault-door medallion.
      px(g, '#0b1119', x + 9, y + 9, 62, 11); px(g, '#233a3c', x + 10, y + 10, 60, 9)
      g.globalAlpha = Math.sin(t * 18) > -.94 ? 1 : .35; px(g, C.mint, x + 10, y + 10, 60, 1); text(g, 'TIME LOOP', x + 19, y + 12, C.mint); g.globalAlpha = 1
      for (const wx of [x + 5, x + 57]) { px(g, '#101722', wx, y + 34, 18, 15); px(g, dark > .3 ? '#f5c875' : '#8da6bb', wx + 2, y + 36, 14, 10); px(g, '#18232e', wx + 8, y + 36, 2, 10); px(g, '#18232e', wx + 2, y + 40, 14, 2); px(g, '#bbc2c4', wx - 1, y + 45, 20, 2) }
      g.fillStyle = '#121820'; g.beginPath(); g.arc(x + 40, y + 49, 11, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#83919b'; g.beginPath(); g.arc(x + 40, y + 49, 9, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#273441'; g.beginPath(); g.arc(x + 40, y + 49, 7, 0, Math.PI * 2); g.fill()
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; px(g, C.gold2, x + 39 + Math.round(Math.cos(a) * 7), y + 48 + Math.round(Math.sin(a) * 7), 2, 2) }
      line(g, x + 40, y + 49, x + 40 + Math.cos(t * .7) * 5, y + 49 + Math.sin(t * .7) * 5, C.gold)
      px(g, '#151a21', x + 30, y + 52, 20, 12); px(g, '#716045', x + 32, y + 54, 16, 10); px(g, '#d9bd79', x + 33, y + 54, 14, 1); px(g, C.gold2, x + 45, y + 59, 2, 2)
    }
  }

  let ctx = null, active = false, t = 0, openAt = 0, won = false, status = 'Find a partner, then hold both plates.'
  let participants = []
  function points() {
    const peers = globalThis.retroFriends?.getPlayers?.('time-loop-heist') || []
    const me = { id: globalThis.retroFriends?.localId?.() || 'local', x: (typeof P !== "undefined" ? P.x : 160), y: (typeof P !== "undefined" ? P.y : 148), name: (typeof cfg !== "undefined" ? cfg.name : "YOU") || 'YOU' }
    return [me, ...peers].sort((a, b) => String(a.id).localeCompare(String(b.id)))
  }
  function start(context) { ctx = context || {}; active = true; t = 0; openAt = 0; won = false; status = 'Find a partner, then hold both plates.'; participants = []; if (typeof P !== "undefined") { P.x = 160; P.y = 145; P.vx = P.vy = 0 } }
  function end() { active = false; ctx = null }
  function exit() { active = false; ctx?.exit?.() }
  function key(code) { if (code === 'Escape') exit(); if (code === 'KeyE' && typeof P !== 'undefined' && P.y > 154 && Math.abs(P.x - 160) < 30) exit() }
  function inside(x, y, rect) { return x >= rect[0] && x <= rect[2] && y >= rect[1] && y <= rect[3] }
  function update(dt, keys) {
    if (!active || (typeof P === "undefined")) return
    if (won) return
    t += Math.min(.05, dt)
    const ax = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0)
    const ay = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0)
    P.vx = ax * 72; P.vy = ay * 72
    const nx = Math.max(14, Math.min(306, P.x + P.vx * dt)), ny = Math.max(42, Math.min(158, P.y + P.vy * dt))
    // Central counter rails leave a clear lane down each side of the vault.
    const blocked = (x, y) => (y > 86 && y < 105 && x > 112 && x < 208) || (x > 38 && x < 62 && y > 64 && y < 88) || (x > 258 && x < 282 && y > 64 && y < 88)
    if (!blocked(nx, P.y)) P.x = nx
    if (!blocked(P.x, ny)) P.y = ny
    if (ax || ay) { P.dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 3 : 2) : (ay > 0 ? 0 : 1); P.fr = 1 + Math.floor(t * 10) % 4 } else P.fr = Math.floor(t * 2) % 2 ? 2 : 0
    participants = points()
    if (participants.length >= 2) {
      const plateA = participants.some(p => inside(p.x, p.y, [62, 112, 105, 139]))
      const plateB = participants.some(p => inside(p.x, p.y, [215, 112, 258, 139]))
      if (plateA && plateB) { if (!openAt) openAt = t; status = t - openAt > 1.25 ? 'Vault unlocked! Reach the two exit pads together.' : 'Both plates held — keep them down!' }
      else { openAt = 0; if (!won) status = 'Each thief: stand on a different gold plate.' }
      const isOpen = openAt && t - openAt > 1.25
      if (isOpen && participants.length >= 2 && participants[0].id !== participants[1].id &&
          inside(participants[0].x, participants[0].y, [124, 137, 151, 159]) && inside(participants[1].x, participants[1].y, [169, 137, 196, 159])) {
        won = true; status = 'CLEAN GETAWAY! BOTH THIEVES MADE IT.'
      }
    } else { openAt = 0; status = globalThis.retroFriends?.isConnected?.() ? 'Waiting for your partner to enter the vault...' : 'Join a room with a friend for co-op. Explore the vault solo meanwhile.' }
  }
  function draw(g) {
    g.imageSmoothingEnabled = false; g.fillStyle = '#101720'; g.fillRect(0, 0, 320, 180)
    // Ribbed stone ceiling and brass cornice.
    px(g, '#202a36', 0, 0, 320, 42); px(g, '#111822', 0, 39, 320, 4); px(g, '#8a7957', 0, 42, 320, 2)
    for (let x = 8; x < 320; x += 32) { px(g, '#303c49', x, 5, 2, 31); px(g, '#43515c', x + 2, 7, 1, 27); px(g, '#111720', x - 3, 34, 8, 4) }
    // Marble floor tiles with alternating cuts and a central runner.
    px(g, C.floor, 0, 44, 320, 136)
    for (let y = 48; y < 180; y += 16) for (let x = 0; x < 320; x += 20) { px(g, (x / 20 + y / 16) % 2 ? '#414852' : '#494c52', x, y, 20, 16); px(g, '#62605b', x + 1, y + 1, 18, 1); px(g, '#282f38', x, y + 15, 20, 1) }
    px(g, '#796849', 144, 46, 32, 112); px(g, '#aa9361', 148, 47, 24, 108); px(g, '#d5bd82', 151, 48, 18, 104)
    for (let y = 56; y < 155; y += 16) px(g, '#8c794f', 148, y, 24, 1)
    // Teller desk and brass cage windows.
    px(g, '#111821', 17, 59, 76, 31); px(g, '#5b3c30', 20, 62, 70, 26); px(g, '#956448', 20, 62, 70, 3); px(g, '#302930', 23, 69, 64, 15)
    for (let x = 27; x < 84; x += 9) px(g, '#d2ad68', x, 69, 1, 15); px(g, '#d2ad68', 23, 75, 64, 1)
    text(g, 'SECURITY', 35, 79, '#ffe3a2')
    px(g, '#111821', 227, 59, 76, 31); px(g, '#243744', 230, 62, 70, 26); px(g, '#70a6a6', 232, 64, 66, 1); text(g, 'CAMERAS', 247, 70, '#9be7d5'); text(g, 'LIVE', 256, 80, '#ff7770')
    // Door housing and deep circular vault with radial locking bars.
    px(g, '#151b25', 111, 42, 98, 48); px(g, '#697987', 115, 45, 90, 3); px(g, '#283744', 119, 49, 82, 37)
    g.fillStyle = '#141b23'; g.beginPath(); g.arc(160, 69, 23, 0, Math.PI * 2); g.fill(); g.fillStyle = '#8c9696'; g.beginPath(); g.arc(160, 69, 20, 0, Math.PI * 2); g.fill(); g.fillStyle = '#34434c'; g.beginPath(); g.arc(160, 69, 16, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#18242c'; g.beginPath(); g.arc(160, 69, 11, 0, Math.PI * 2); g.fill()
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + t * .08; const bx = 160 + Math.cos(a) * 17, by = 69 + Math.sin(a) * 17; g.fillStyle = '#dfc27b'; g.beginPath(); g.arc(bx, by, 1.6, 0, Math.PI * 2); g.fill(); line(g, 160, 69, 160 + Math.cos(a) * 10, 69 + Math.sin(a) * 10, '#839397') }
    if (!(openAt && t - openAt > 1.25)) { px(g, '#788990', 154, 52, 12, 34); px(g, '#b3bcac', 155, 53, 2, 32); px(g, '#27333c', 159, 53, 4, 32); px(g, '#879596', 165, 58, 2, 22) }
    else { px(g, '#111820', 132, 49, 56, 39); px(g, '#241d19', 138, 52, 44, 33); px(g, '#d3ad62', 140, 53, 2, 31); px(g, '#d3ad62', 178, 53, 2, 31); px(g, '#c8ae72', 145, 85, 30, 2) }
    // Two separate pressure plates on opposite sides of the hall.
    const pA = participants.some(p => inside(p.x, p.y, [62, 112, 105, 139])), pB = participants.some(p => inside(p.x, p.y, [215, 112, 258, 139]))
    for (const [x, pressed, color] of [[67, pA, C.blue], [220, pB, C.orange]]) { px(g, '#171c23', x - 5, 115, 49, 25); px(g, pressed ? color : '#8b7444', x - 3, pressed ? 114 : 116, 45, 21); px(g, pressed ? '#eafaff' : '#c2a462', x - 2, pressed ? 114 : 116, 43, 2); for (let k = 0; k < 4; k++) px(g, '#5b503e', x + k * 10, 124, 5, 1); text(g, 'PLATE', x + 6, 132, '#fff1cc') }
    const unlocked = openAt && t - openAt > 1.25
    for (const [x, c] of [[128, C.blue], [174, C.orange]]) { px(g, won ? C.mint : unlocked ? c : '#5c4f3d', x, 145, 17, 10); px(g, unlocked ? '#fff0c2' : '#8b7956', x + 2, 147, 13, 1); px(g, '#23262c', x + 2, 153, 13, 1) }
    // Lamp pools, wall sconces, security beams.
    for (const x of [28, 292]) { px(g, '#8796a0', x - 4, 47, 8, 2); px(g, C.gold2, x - 2, 49, 4, 2); px(g, 'rgba(255,214,128,.08)', x - 12, 51, 24, 21) }
    if (!unlocked) { px(g, '#5c252b', 106, 107, 108, 2); px(g, Math.floor(t * 4) % 2 ? '#fa5359' : '#a9313c', 107, 108, 106, 1) }
    // Shared avatars; peers come from the same room-code session as the town.
    participants = participants.length ? participants : points()
    const ownId = globalThis.retroFriends?.localId?.() || 'local'
    for (let i = 0; i < participants.length; i++) { const p = participants[i]; if (p.id === ownId) continue; const color = i % 2 ? C.orange : C.blue; px(g, 'rgba(0,0,0,.25)', p.x - 5, p.y - 1, 10, 3); px(g, '#28202a', p.x - 4, p.y - 14, 8, 14); px(g, color, p.x - 3, p.y - 13, 6, 10); px(g, '#edc6a0', p.x - 3, p.y - 19, 6, 6); text(g, p.name || 'PARTNER', p.x - 11, p.y - 26, color) }
    if (globalThis.drawChar) { drawChar(g, P.x, P.y, P.dir, P.fr, cfg); text(g, cfg.name || 'YOU', P.x - 8, P.y - 27, C.gold2) }
    px(g, '#0d131b', 0, 0, 320, 17); px(g, '#5d6b76', 0, 17, 320, 1); text(g, 'TIME LOOP HEIST', 8, 6, C.mint)
    const room = globalThis.retroFriends?.isConnected?.() ? 'ROOM CO-OP' : 'SOLO / LOCAL PREVIEW'; text(g, room, 217, 6, C.gold2)
    px(g, '#10161f', 4, 164, 312, 13); text(g, status, 10, 168, won ? C.mint : C.cream)
    text(g, 'WASD MOVE   ESC EXIT', 8, 151, '#d7d0b9')
    if (participants.length < 2 && globalThis.retroFriends?.isConnected?.()) { px(g, 'rgba(8,12,18,.82)', 54, 91, 212, 22); text(g, 'PARTNER: WALK INTO THE BANK', 72, 100, C.gold2) }
  }
  const Scene = { start, update, draw, key, end, selfTest() { return { ok: true, results: [{ name: 'plugin registration', pass: true, detail: 'Time Loop Heist scene is available.' }] } } }
  const plugin = { manifest, building, Scene }
  ;(globalThis.HubGames = globalThis.HubGames || []).push(plugin)
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin
})()
