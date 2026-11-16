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

## Project layout

- `public/index.html` contains the hub, character creator, and game loop.
- `public/village/` contains the village controls, map layers, collision data, and credits.
- `server.cjs` serves the browser files on localhost.
- `start-retro-hub.bat` starts the server on Windows.

## Credits

See [village credits](public/village/CREDITS.txt) for the source of the imported map and tiles. The repository does not currently declare a license for the original Retro Hub code. Check the upstream terms before redistributing the imported files.
