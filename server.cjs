const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/village/borders.js', ['village/borders.js', 'text/javascript; charset=utf-8']],
  ['/village/explore.js', ['village/explore.js', 'text/javascript; charset=utf-8']],
  ['/village/pallet-town.png', ['village/pallet-town.png', 'image/png']],
  ['/village/foreground-map.png', ['village/foreground-map.png', 'image/png']],
])
const hosts = ['127.0.0.1', '::1']
const servers = hosts.map((host) => {
  const server = http.createServer((request, response) => {
    const pathname = request.url.split('?')[0]
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
      'Content-Length': page.length
    })
    response.end(request.method === 'HEAD' ? undefined : page)
  })
  server.on('error', (error) => {
    if (host === '::1' && ['EADDRNOTAVAIL', 'EAFNOSUPPORT'].includes(error.code)) return
    console.error(error.message)
    process.exit(1)
  })
  server.listen(5500, host)
  return server
})

servers[0].on('listening', () => console.log('Retro Hub is running at http://localhost:5500/'))

