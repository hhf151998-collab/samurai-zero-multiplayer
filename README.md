# Samurai Zero: Pixel Clash — restored Dojo edition

Online 5v5 cyber-samurai arena, based on the recovered original game. Animated pixel characters, team rosters, adjustable bots, room invitation links, three-minute matches and server-owned simulation.

The 2200×1500 dojo includes breakable bamboo, explosive barrels, pressure plates and retracting bridges, laser mirrors and 150-point vaults, stealth zones, wind pads, healing/shield shrines, paired teleporters, temporary power scrolls, radar towers, lever gates, gravity fields and a 250-point Oni event. Three character skills: Blink Slash, Shock Slam and EMP Pulse. Artwork is drawn locally with Canvas; no image-generation or paid API services are used.

## Play

Choose a character and clan. ENTER CLASH creates a room and starts immediately for solo play. To invite friends first, choose JOIN ROOM with a blank code, COPY INVITE, wait for friends, then ENTER CLASH. The room host controls bots and match starts. Human players replace bots when joining an active match.

WASD/arrows move; J or click slashes; Space dashes; K/E uses the skill. Touch users have a movement pad and three action buttons. ZOOM cycles WIDE / NORMAL / TACTICAL. MAP GUIDE explains objectives. LOBBY leaves the room.

## Run / deploy

`npm install --ignore-scripts`, then `npm start`. Local default port: 3001; hosted services use PORT. Health endpoint: `/health`. Render: Node, Free compute, build `npm install --ignore-scripts`, start `npm start`. Rooms are memory-only and reset on service restarts. Free hosting can sleep and takes time to wake.

## Verification

`node test.cjs` tests interactive mechanics and a complete round. `node online-test.cjs` tests Socket.IO room sharing, expanded world synchronization, movement, dash, bots, late joining and host migration. Set TEST_URL to the public origin to test the deployed service.
