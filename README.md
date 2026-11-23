# Retro Hub

A pixel-art browser game with a walkable arcade town, customizable heroes, and an explorable village.

## Run locally

Install Node.js, then double-click `start-retro-hub.bat` on Windows or run `node server.cjs` from the project directory. Open [Retro Hub](http://localhost:5500/) in your browser. Press Ctrl+C in the server terminal to stop it.

## Controls

- WASD or arrow keys to move
- Shift to run
- E to interact in the hub
- Esc to open the hub menu or return from the village
- Choose **Explore village** from the hub menu to visit the imported map

- Inside the arcade, press E at the middle cabinet to play Pong. Use W/S or the arrow keys to move, E or Space to serve, and Esc to exit.

## Project layout

- `public/index.html` contains the hub, character creator, and game loop.
- `public/village/` contains the village controls, map layers, collision data, and credits.
- `public/games/time-loop-heist/game.js` contains the Time Loop Heist bank building and co-op vault interior.
- `public/games/pixel-garden/game.js` contains the Pixel Garden greenhouse and garden scene.
- `server.cjs` serves the browser files on localhost.
- `start-retro-hub.bat` starts the server on Windows.

## Credits

See [village credits](public/village/CREDITS.txt) for the source of the imported map and tiles. The repository does not currently declare a license for the original Retro Hub code. Check the upstream terms before redistributing the imported files.

## Play with friends

Choose **Play with friends** on the character screen, then **Create room**. Copy the invite link and send it to your friends. They open that link, create their hero, choose **Play with friends**, then **Join room**. Click **Resume** to walk around together. Rooms support up to 8 players.

Everyone must use the same server address. A localhost invite works only on the host computer. Internet players need the game's public HTTPS address, supplied by a hosting service or a temporary tunnel.

Characters, names, movement, and current location are shared across the hub, arcade interior, village, and game interiors. Each player keeps their own coins, weather, and Pong game. Rooms live in one server process and disappear when it restarts. Disconnected players expire after 30 seconds and can join again with the room code while others remain.

## Run the multiplayer server

Use Node.js 20 or newer and run `node server.cjs`. The default address is `127.0.0.1:5500`. Hosting providers can set `PORT` and `HOST=0.0.0.0`. Set `PUBLIC_URL` to the public HTTPS address so invites copied from localhost also work for friends. Run one server instance so all rooms share the same memory.

Run connection checks with `node --test test/rooms.test.cjs`.

## Asteroids observatory

Walk southeast from the fountain to the **ASTEROIDS** house, just north of the racing track. Press **E** at the door, walk up to the central cabinet, and press **E** again.

- **Space**, **Enter**, or **E** launches a round.
- **A/D** or **Left/Right** rotates your ship.
- **W** or **Up** adds thrust. Hold **Space** to fire.
- **Esc** returns from the game to the observatory. Walk onto the red exit mat to return to town.

Playing alone starts a solo flight. Friends in the same room can enter the cabinet to join the same cooperative round, with shared rocks, waves, and team score. Each pilot has their own ship, score, and three lives. Ships cannot damage each other. Surviving pilots can continue after a teammate runs out of lives. A new pilot may join a running mission. After the squad is defeated, pressing Space restarts together.

Rocks split into smaller pieces, ships and shots wrap around the screen, and pilots receive a bonus life every 2,000 personal points (up to five lives). At mission end, each pilot earns one hub coin per 100 personal points, up to 50 coins per mission. The shared server controls multiplayer collisions and scoring.

The supplied Claude prototype's building artwork is preserved in `public/games/asteroids/building.js`. The shared simulation is in `engine.js`, and the interior, controls, and presentation are in `scene.js`. Run all checks with `node --test test/*.test.cjs`.

## Turbo Lap go-kart center

The checkered **KART CENTER** sits at the east end of the racing track. Enter the garage, walk to the middle grid kart, and press **E** to open its indoor circuit.

- **W/Up** accelerates; **S/Down** brakes and reverses.
- **A/D** or **Left/Right** steers; **Space** drifts; **R** restarts a run.
- Finish three laps to earn a medal and hub coins. Your best lap reappears as a ghost on future runs.
- Press **Esc** to return to the garage, then walk down to the exit mat to return to town.

The building and complete kart circuit come from `Retro Hub_ Game Preview.html` and are integrated as `public/games/turbo-lap/game.js`.

## Pixel Garden

Find the glass **PIXEL GARDEN** greenhouse between Contributors Wall and Memory Match. Enter it with **E**. Walk up to a planter and press **E** to plant a seed, water a growing sprout, or harvest a bloom for a coin. In a multiplayer room, all visitors tend the same four shared beds and can see each other in the greenhouse. Press **Esc** to leave.

## Time Loop Heist

The steel bank with the mint clock sign is the Time Loop Heist house. Walk to its front door, press **E**, then press **E** on its info card to enter the vault. In a room with a friend, each thief stands on a different colored plate; hold both to open the vault, then reach the matching blue or orange exit pad. The room sync shares positions, so both players see the same plate and vault state. Press **Esc** to return to town. Without a room, the interior is available as a solo preview.
