# Kurukkanmoola X

A browser-based 3D Kerala open-world game built with Three.js. Includes the existing guest multiplayer system, live player positions, private messages and a session leaderboard.

## Run locally

Requirements: Node.js 18 or newer.

```bash
npm install
npm start
```

Open the local URL printed in the terminal (normally `http://localhost:8080`). Do not open `index.html` directly because browser ES modules need to be served over HTTP.

## Publish online with multiplayer

**Important:** GitHub is for storing the source code. GitHub Pages only hosts static files and cannot run this game's Node.js multiplayer server. To let players in different locations meet in the same world, deploy the complete project as a Node web service.

### Recommended: GitHub + Render

1. Create a new GitHub repository named `kurukkanmoola-x`.
2. Extract this ZIP. Upload the *contents of this folder* to the repository root (so `package.json`, `index.html`, `server.mjs` and `src/` are at the top level, not buried inside another ZIP or folder).
3. Commit the files to the `main` branch.
4. Sign in to Render and choose **New → Blueprint**. Connect your GitHub repository.
5. Render detects `render.yaml`. Review and create the service. It installs dependencies and starts `npm start`.
6. When deployment finishes, open the `onrender.com` URL. Share that URL with other players. Everyone must use the same deployed URL to join the same server.

You can also create a Render **Web Service** manually with:
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/`

The included server uses Render's `PORT` environment variable automatically.

## Multiplayer notes

- The server currently keeps player sessions and messages in memory. Online players can see other connected players, send private messages and appear on the live session leaderboard.
- This is lightweight guest multiplayer, not a full authoritative MMO server. Positions and scores are client-submitted. Do not use it for sensitive data or competitive play.
- Free hosting may sleep when idle, so the first visit after inactivity can take a little time to wake up. Server restarts clear active players and messages.
- Use a persistent database and server-side validation before adding accounts, permanent progression, purchases or public competitive leaderboards.

## Controls

| Key | Action |
|---|---|
| WASD / arrows | Move |
| Shift | Run |
| E | Enter / exit nearby vehicle or interact |
| Space | Jump / brake |
| Ctrl | Aircraft descend |
| Mouse drag / wheel | Orbit / zoom |
| F | Talk / work |
| M | Map |
| V | Vehicle directory |
| C | Camera |
| T | Weather |
| Esc | Pause/settings |

## Development checks

```bash
npm test
npm run check
```

## Project structure

- `index.html`, `style.css`: game interface
- `src/`: game, world, environment and gameplay systems
- `server.mjs`: HTTP server and guest multiplayer API
- `assets/`: game models, textures, fonts and audio
- `tests/`: automated world and road tests
