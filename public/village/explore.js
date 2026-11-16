const village = {
  active: false,
  x: 109 * 16 + 8,
  y: 33 * 16 + 8,
  direction: 0,
  steps: 0
}
const villageGround = new Image()
const villageForeground = new Image()
villageGround.src = '/village/pallet-town.png'
villageForeground.src = '/village/foreground-map.png'

function villageBlocked(x, y) {
  const col = Math.floor(x / 16)
  const row = Math.floor(y / 16)
  return col < 0 || col >= 140 || row < 0 || row >= 80 || borderBlocks[row * 140 + col] === 1432
}

function updateVillage(dt) {
  const dx = Number(!!(keys.KeyD || keys.ArrowRight)) - Number(!!(keys.KeyA || keys.ArrowLeft))
  const dy = Number(!!(keys.KeyS || keys.ArrowDown)) - Number(!!(keys.KeyW || keys.ArrowUp))
  if (!dx && !dy) {
    village.steps = 0
    return
  }
  const speed = (keys.ShiftLeft || keys.ShiftRight ? 84 : 54) * dt / Math.hypot(dx, dy)
  const x = village.x + dx * speed
  const y = village.y + dy * speed
  if (!villageBlocked(x - 3, village.y) && !villageBlocked(x + 3, village.y)) village.x = x
  if (!villageBlocked(village.x - 3, y) && !villageBlocked(village.x + 3, y)) village.y = y
  village.direction = dx ? (dx > 0 ? 3 : 2) : (dy > 0 ? 0 : 1)
  village.steps += dt * 8
}

function drawVillage() {
  const x = Math.round(clamp(village.x - VW / 2, 0, 2240 - VW))
  const y = Math.round(clamp(village.y - VH / 2, 0, 1280 - VH))
  const drawLayer = image => g.drawImage(image, x * 3.5, y * 3.5, VW * 3.5, VH * 3.5, 0, 0, VW, VH)
  if (!villageGround.complete || !villageGround.naturalWidth) {
    g.fillStyle = K.ink
    g.fillRect(0, 0, VW, VH)
    txt('VILLAGE MAP LOADING', 10, 10, K.tx)
  } else {
    drawLayer(villageGround)
    drawChar(g, Math.round(village.x) - x, Math.round(village.y) - y, village.direction, village.steps ? 1 + Math.floor(village.steps) % 4 : 0, cfg)
    if (villageForeground.complete && villageForeground.naturalWidth) drawLayer(villageForeground)
  }
  box(5, VH - 19, 123, 14)
  txt('ESC RETURN TO HUB', 10, VH - 15, K.tx)
}
