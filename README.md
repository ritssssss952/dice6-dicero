# DICE 6 — DICERO FINAL

One game, two modes:
- OFFLINE: one device, six players.
- ONLINE: one public HTTPS game link, room code, up to six players.

Players do not install Node.js, npm, CMD, or a server. They only open the game link in Chrome.

## Online architecture
The browser game uses PeerJS/WebRTC for real-time peer connections. The room code is also the host PeerJS ID, so Join uses the exact code shown to the host. The included Node server only serves the game files; PeerJS provides the signaling service.

## Owner deployment
The included `server.js`, Dockerfile and Render configuration are ready for an HTTPS web host. Once deployed, share the HTTPS URL. Do not share this ZIP with players.

## Local owner test
Install Node.js 18+ once, then double-click `start-server.bat` and open `http://localhost:3000`. This is only for testing. Real players in different cities need the deployed HTTPS URL.

## Safety
Use nicknames. Do not enter phone numbers, passwords, addresses, payment details or other private information. Share room codes only with intended players.
