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
- `server.cjs` serves the browser files on localhost.
- `start-retro-hub.bat` starts the server on Windows.

## Credits

See [village credits](public/village/CREDITS.txt) for the source of the imported map and tiles. The repository does not currently declare a license for the original Retro Hub code. Check the upstream terms before redistributing the imported files.

## Play with friends

Choose **Play with friends** on the character screen, then **Create room**. Copy the invite link and send it to your friends. They open that link, create their hero, choose **Play with friends**, then **Join room**. Click **Resume** to walk around together. Rooms support up to 8 players.

Everyone must use the same server address. A localhost invite works only on the host computer. Internet players need the game's public HTTPS address, supplied by a hosting service or a temporary tunnel.

Characters, names, movement, and current location are shared across the hub, arcade interior, and village. Each player keeps their own coins, weather, and Pong game. Rooms live in one server process and disappear when it restarts. Disconnected players expire after 30 seconds and can join again with the room code while others remain.

## Run the multiplayer server

Use Node.js 20 or newer and run `node server.cjs`. The default address is `127.0.0.1:5500`. Hosting providers can set `PORT` and `HOST=0.0.0.0`. Run one server instance so all rooms share the same memory.

Run connection checks with `node --test test/rooms.test.cjs`.
