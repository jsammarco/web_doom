# Iron Maze

Iron Maze is a browser-based, Doom-inspired raycasting game built with plain HTML, CSS, and JavaScript. Explore a dark maze, find the keycard, survive the hostiles, and reach the exit.

## Features

- First-person raycast maze rendering
- Perspective-correct textured floor and walls
- Randomized hostile placement each time the level starts
- Keycard, medkit, exit, and enemy pickups/entities
- Optional hostile cleanup for bonus score
- Discovered-area minimap
- Keyboard and touch controls
- Weapon animation and gunshot audio
- Looping background music from `assets/music.mp3`

## How To Run

This project is static, so it can run from a simple local web server.

```powershell
python -m http.server 5173 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:5173/
```

You can also use any other static file server.

## Controls

- `W`: move forward
- `S`: move backward
- `A`: turn left
- `D`: turn right
- `Space`: fire
- `Enter`: start or restart
- Pointer/tap on the game screen: fire

Touch controls appear automatically on coarse pointer devices and smaller screens.

## Objective

Find the keycard and reach the exit. You no longer need to clear every hostile to finish the level, but every hostile defeated adds score, and clearing all hostiles before exiting earns a clean-sweep bonus.

## Project Structure

```text
.
|-- index.html
|-- style.css
|-- game.js
`-- assets/
    |-- door.png
    |-- enemy.png
    |-- exit.png
    |-- floor.png
    |-- gun_shot.mp3
    |-- keycard.png
    |-- medkit.png
    |-- music.mp3
    |-- wall.png
    |-- weapon.png
    `-- weapon_sprites_clean.png
```

## Development Notes

The game has no build step and no package dependencies. Most gameplay logic, rendering, collision, audio, scoring, and minimap behavior live in `game.js`.

Before sharing changes, a quick syntax check is useful:

```powershell
node --check game.js
```
