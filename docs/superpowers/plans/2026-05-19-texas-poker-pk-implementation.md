# Texas Poker PK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old LLM answer-battle game with a server-authoritative 2-6 player Texas Poker PK game that supports seat selection, five draw/swap rounds, standard 7-card poker evaluation, multi-hand matches, and local browser testing.

**Architecture:** Rebuild the missing NestJS server source with focused poker rule modules, a room service, and a Socket.IO gateway. Rewrite the React client around public/private game state, waiting-room seat selection, and an interactive poker table.

**Tech Stack:** NestJS, Socket.IO, TypeScript, React 19, Vite, Node test runner.

---

## Files

- Create `server/package.json`, `server/tsconfig.json`, and `server/src/**`.
- Create server tests in `server/test/poker-rules.test.js`.
- Replace `client/src/types/game.ts`, `client/src/hooks/useSocket.ts`, `client/src/context/GameContext.tsx`, `client/src/App.tsx`, `client/src/App.css`.
- Replace `client/src/components/Lobby.tsx`; create `client/src/components/PokerTable.tsx`.
- Leave unused old components in place only if they compile; remove imports from the app shell.
- Update `AIququ-fighting_agent.md` and `lessons.md` after implementation discoveries.

## Tasks

### Task 1: Server Poker Rules

**Files:**
- Create: `server/src/poker/types.ts`
- Create: `server/src/poker/deck.ts`
- Create: `server/src/poker/hand-evaluator.ts`
- Test: `server/test/poker-rules.test.js`

- [ ] Write failing tests for deck uniqueness, 6-player card budget, straight/flush/full-house comparison, and exact-tie winners.
- [ ] Run `node --test server/test/poker-rules.test.js`; expect module-not-found or missing export failure.
- [ ] Implement card, deck, shuffle, draw, and standard Texas Hold'em 7-card evaluator.
- [ ] Build with `server/node_modules/.bin/tsc.cmd -p server/tsconfig.json`.
- [ ] Run `node --test server/test/poker-rules.test.js`; expect pass.

### Task 2: Server Room State Machine

**Files:**
- Create: `server/src/game/room.service.ts`
- Create: `server/src/game/game.gateway.ts`
- Create: `server/src/game/game.module.ts`
- Create: `server/src/app.module.ts`
- Create: `server/src/main.ts`

- [ ] Implement rooms, player join, seat selection, host match config, start game, turn timers, submit action, continue next hand, disconnect handling, and public/private state projection.
- [ ] Build with `server/node_modules/.bin/tsc.cmd -p server/tsconfig.json`.
- [ ] Smoke test by starting `node server/dist/main.js` and confirming the server listens on port 3000.

### Task 3: React State And Socket API

**Files:**
- Modify: `client/src/types/game.ts`
- Modify: `client/src/hooks/useSocket.ts`
- Modify: `client/src/context/GameContext.tsx`

- [ ] Replace old LLM battle types with poker public/private state types.
- [ ] Replace socket senders with create, join, select seat, set match config, start, submit turn action, and continue next hand.
- [ ] Listen for public/private state, room created, joined, turn resolved, showdown reveal, hand result, match complete, error, and game cancelled.
- [ ] Run `client/node_modules/.bin/tsc.cmd -b client/tsconfig.json`; expect client type errors from unfinished UI until Task 4 is done.

### Task 4: React UI

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/Lobby.tsx`
- Create: `client/src/components/PokerTable.tsx`
- Modify: `client/src/App.css`

- [ ] Build waiting room with nickname entry, room code join, 2-6 seat grid, visible seat numbers, host match count 1-5, and start button.
- [ ] Build poker table with seats, community cards, public discards, private hand, stash, timer, turn actions, automatic post-action end, showdown reveal, rankings, continue buttons, and match complete state.
- [ ] Run `client/node_modules/.bin/tsc.cmd -b client/tsconfig.json`; expect pass.
- [ ] Run `client/node_modules/.bin/vite.cmd build`; expect pass.

### Task 5: End-To-End Local Verification

**Files:**
- No required source edits unless verification finds a bug.

- [ ] Start server with `node server/dist/main.js`.
- [ ] Start client with `client/node_modules/.bin/vite.cmd --host 127.0.0.1`.
- [ ] Open the local app in a browser, create a room, join from another tab, select seats, start a 1-hand match, perform at least one swap/no-op flow, and verify the UI reaches hand result or handles timeouts.
- [ ] If verification finds a bug, write a focused failing test for the affected rule when possible, fix, rebuild, and rerun verification.
