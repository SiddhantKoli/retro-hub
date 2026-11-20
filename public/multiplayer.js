(() => {
  const codeInput = document.querySelector('#room-code')
  const message = document.querySelector('#room-message')
  const createButton = document.querySelector('#room-create')
  const joinButton = document.querySelector('#room-join')
  const leaveButton = document.querySelector('#room-leave')
  const copyButton = document.querySelector('#room-copy')
  const badge = document.querySelector('#room-badge')
  const roster = document.querySelector('#room-roster')
  let session = null
  let joining = false
  let generation = 0
  let timer
  let peers = []
  let failures = 0

  const inviteCode = new URL(location.href).searchParams.get('room')
  if (/^[A-F0-9]{8}$/i.test(inviteCode || '')) codeInput.value = inviteCode.toUpperCase()

  function state() {
    const inVillage = village.active
    return {
      x: inVillage ? village.x : P.x,
      y: inVillage ? village.y : P.y,
      direction: inVillage ? village.direction : P.dir,
      frame: inVillage ? (village.steps ? 1 + Math.floor(village.steps) % 4 : 0) : P.fr,
      // Keep the heist compatible with a room server that was already running
      // before the new server-side scene allowlist was loaded.
      scene: inVillage ? 'village' : scene === 'time-loop-heist' ? 'asteroids-lobby' : scene,
      appearance: { ...cfg },
      asteroidsInput: scene === 'asteroids' ? AsteroidsGame.input() : undefined
    }
  }

  async function api(route, data) {
    const response = await fetch('/api/' + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(6000)
    })
    const result = await response.json()
    if (!response.ok) {
      const error = new Error(result.error || 'Could not reach the room server.')
      error.status = response.status
      throw error
    }
    return result
  }

  function controls() {
    createButton.disabled = joining || !!session
    joinButton.disabled = joining || !!session
    codeInput.disabled = joining || !!session
    leaveButton.hidden = !session
    copyButton.hidden = !session
    badge.hidden = !session
  }

  function clearSession(text) {
    generation++
    clearTimeout(timer)
    session = null
    peers = []
    failures = 0
    roster.textContent = ''
    message.textContent = text
    controls()
  }

  async function join(route) {
    if (joining || session) return
    const code = codeInput.value.trim().toUpperCase()
    if (route === 'join' && !/^[A-F0-9]{8}$/.test(code)) {
      message.textContent = 'Enter the 8-character room code.'
      return
    }
    joining = true
    controls()
    message.textContent = route === 'rooms' ? 'Creating room…' : 'Joining room…'
    try {
      session = await api(route, { code, state: state() })
      codeInput.value = session.code
      generation++
      message.textContent = 'Room ' + session.code + ' — share the link, then Resume to explore.'
      badge.textContent = 'ROOM ' + session.code + ' · 1/8'
      sync(generation)
    } catch (error) {
      message.textContent = error.message
    } finally {
      joining = false
      controls()
    }
  }

  async function sync(currentGeneration) {
    if (!session || currentGeneration !== generation) return
    const active = session
    try {
      const result = await api('sync', { ...active, state: state() })
      if (currentGeneration !== generation) return
      if (scene === 'asteroids') AsteroidsGame.receive(result.asteroids, active.id)
      const previous = new Map(peers.map(peer => [peer.id, peer]))
      const now = performance.now()
      peers = result.players.filter(player => player.id !== active.id).map(player => {
        const before = previous.get(player.id)
        const sameScene = before?.scene === player.scene
        return {
          ...player,
          fromX: sameScene ? before.displayX : player.x,
          fromY: sameScene ? before.displayY : player.y,
          displayX: sameScene ? before.displayX : player.x,
          displayY: sameScene ? before.displayY : player.y,
          received: now
        }
      })
      if (failures) message.textContent = 'Connected to room ' + active.code + '.'
      failures = 0
      badge.hidden = scene === 'asteroids' || scene === 'turbo-lap'
      badge.textContent = 'ROOM ' + active.code + ' · ' + result.players.length + '/8'
      roster.textContent = result.players.map(player =>
        player.appearance.name + (player.id === active.id ? ' (you)' : '') +
        ' — ' + ({town: 'Hub', inside: 'Arcade', pong: 'Playing Pong', 'asteroids-lobby': 'Observatory', asteroids: 'Flying Asteroids', 'kart-lobby': 'Kart Center', 'turbo-lap': 'Racing karts', 'time-loop-heist': 'Time Loop Heist', village: 'Village'}[player.scene])
      ).join(' · ')
    } catch (error) {
      if (currentGeneration !== generation) return
      if (error.status === 410) {
        clearSession(error.message)
        return
      }
      failures++
      badge.textContent = 'ROOM ' + active.code + ' · Reconnecting…'
      message.textContent = 'Connection interrupted. Retrying automatically.'
      if (failures >= 3) peers = []
    }
    if (currentGeneration === generation) timer = setTimeout(() => sync(currentGeneration), failures ? 1500 : 100)
  }

  window.retroFriends = {
    isConnected() { return !!session },
    localId() { return session?.id || 'local' },
    getPlayers(currentScene) {
      const roomScene = currentScene === 'time-loop-heist' ? 'asteroids-lobby' : currentScene
      const now = performance.now()
      return peers.filter(peer => peer.scene === roomScene).map(peer => {
        const amount = Math.min(1, (now - peer.received) / 120)
        peer.displayX = peer.fromX + (peer.x - peer.fromX) * amount
        peer.displayY = peer.fromY + (peer.y - peer.fromY) * amount
        return { id: peer.id, x: peer.displayX, y: peer.displayY,
          name: peer.appearance.name, direction: peer.direction, frame: peer.frame }
      })
    },
    addPlayers(items, currentScene, ox, oy) {
      for (const peer of peers) {
        if (peer.scene !== currentScene) continue
        const amount = Math.min(1, (performance.now() - peer.received) / 120)
        peer.displayX = peer.fromX + (peer.x - peer.fromX) * amount
        peer.displayY = peer.fromY + (peer.y - peer.fromY) * amount
        items.push([peer.displayY, () => {
          const x = Math.round(peer.displayX - ox)
          const y = Math.round(peer.displayY - oy)
          if (x < -30 || x > VW + 30 || y < -10 || y > VH + 45) return
          drawChar(g, x, y, peer.direction, peer.frame, peer.appearance)
          txt(peer.appearance.name, x - tw(peer.appearance.name) / 2,
            y - 39 - (peer.appearance.cap === 3 ? 7 : 0), '#9fe8b0', 1, 1)
        }])
      }
    }
  }
  createButton.onclick = () => join('rooms')
  joinButton.onclick = () => join('join')
  codeInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') join('join')
  })
  leaveButton.onclick = () => {
    const active = session
    clearSession('You left the room.')
    if (active) api('leave', active).catch(() => {})
  }
  copyButton.onclick = async () => {
    if (!session) return
    const url = new URL(session.inviteBase || location.href)
    url.searchParams.set('room', session.code)
    try {
      await navigator.clipboard.writeText(url.toString())
      message.textContent = 'Invite link copied.'
    } catch {
      message.textContent = 'Share this address with your friend: ' + url.toString()
    }
  }
  document.querySelector('#friends-start').onclick = () => {
    doStart()
    setMenu(true)
    codeInput.focus()
  }
  addEventListener('pagehide', () => {
    if (session) navigator.sendBeacon('/api/leave', new Blob([JSON.stringify(session)], {type: 'application/json'}))
  })
  controls()
})()
