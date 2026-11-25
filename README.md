# Samurai Zero: Pixel Clash

Browser multiplayer arena with Node.js and Socket.IO. Two teams, up to ten human players, bots filling to 5v5, three classes, three-minute rounds, room invitations, keyboard and touch controls.

Run `npm install`, then `npm start`. Open http://localhost:3000. Create a room by leaving its code blank, copy the invitation, and let the host start the match. J attacks, Space dashes, K uses a skill; WASD/arrows move. The mobile pad and buttons provide the same actions.

The server owns movement, damage, scoring, bot AI and match time. Rooms are in memory and disappear when all human players leave or the service restarts. This is the simplified multiplayer version recovered from the original conversation, not the larger original PvPvE game.

## Render

Create a Node web service from this repository. Select **Free** explicitly. Build: `npm install --ignore-scripts`. Start: `npm start`. Health check: `/health`. The server uses Render's PORT automatically. Do not add a payment method for a no-charge deployment; check existing billing settings before publishing. Free services can sleep when idle and take time to wake.

## Verification

Run `node test.cjs` with the service running. Set TEST_URL to the public origin to repeat against deployment. Tests cover real WebSocket connections, room sharing, host-only start, bot filling, synchronized movement, mid-match joins, disconnect replacement and host migration.
