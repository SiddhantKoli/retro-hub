const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { createRooms } = require('./server/rooms.cjs')

const files = new Map([
  ['/games/asteroids/engine.js', ['games/asteroids/engine.js', 'text/javascript; charset=utf-8']],
  ['/games/asteroids/building.js', ['games/asteroids/building.js', 'text/javascript; charset=utf-8']],
  ['/games/asteroids/scene.js', ['games/asteroids/scene.js', 'text/javascript; charset=utf-8']],
  ['/games/turbo-lap/game.js', ['games/turbo-lap/game.js', 'text/javascript; charset=utf-8']],
  ['/games/time-loop-heist/game.js', ['games/time-loop-heist/game.js', 'text/javascript; charset=utf-8']],
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/multiplayer.js', ['multiplayer.js', 'text/javascript; charset=utf-8']],
  ['/village/borders.js', ['village/borders.js', 'text/javascript; charset=utf-8']],
  ['/village/explore.js', ['village/explore.js', 'text/javascript; charset=utf-8']],
  ['/village/pallet-town.png', ['village/pallet-town.png', 'image/png']],
  ['/village/foreground-map.png', ['village/foreground-map.png', 'image/png']]
])

const handleRooms = createRooms()
const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname
    if (await handleRooms(request, response, pathname)) return
    const file = files.get(pathname)
    if (!file) {
      response.writeHead(404).end()
      return
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end()
      return
    }
    const [filename, contentType] = file
    const page = fs.readFileSync(path.join(__dirname, 'public', filename))
    response.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': page.length,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    })
    response.end(request.method === 'HEAD' ? undefined : page)
  } catch (error) {
    console.error(error.message)
    if (!response.headersSent) response.writeHead(500)
    response.end()
  }
})
server.requestTimeout = 10000
server.headersTimeout = 10000
server.on('error', error => {
  console.error(error.message)
  process.exitCode = 1
})
if (require.main === module) {
  const port = Number(process.env.PORT || 5500)
  const host = process.env.HOST || '127.0.0.1'
  server.listen(port, host, () => console.log('Retro Hub running on ' + host + ':' + server.address().port))
}
module.exports = server
