# Hashi • Cohort Quiz Platform

A React application with an Express backend for the 30-minute Round 2 competition. Both tracks contain three sequential challenges:

- **Track 1 / First Years:** Hashi, Pig Fortress, and 25 Officers.
- **Track 2 / Other Years:** Hashi Hard, Deepfake, and Zero to Crore.

## Run

Requires Node.js 18 or newer and npm.

```bash
npm ci
npm start
```

`npm start` builds the React application and serves it at `http://localhost:3000`. Set `PORT` to change the port. For frontend development:

```bash
npm run dev
```

The development command rebuilds React source changes automatically. Refresh the page after changes; restart the command after backend changes.

For deployment, run `npm ci && npm run build`, then `node server.js`. The included Render configuration uses these commands. Serve the generated `dist/` folder through Express so the UI and API share an origin. Build dependencies must be installed during the build step.

## Acceptance and round state

The server is the authority for accepted answers, stage unlocks, scores, timer deadlines, and rewards. Browser storage keeps the session token and draft answers; stored client completion flags are never trusted.

- **Hashi:** integer endpoints, one or two bridges per unique pair, no self-loops, orthogonal neighboring islands, no crossings, exact degrees, and one connected network.
- **Pig Fortress:** every pig classification, all five launch positions, total damage, and the PIN must be correct together.
- **25 Officers:** all 25 cells must contain allowed officers; colors and pieces must be unique in every row and column, and all 25 pairs must be distinct. A passcode alone is no longer accepted.
- **Deepfake:** both the selected video and all five separate upload positions must be correct.
- **Zero to Crore:** all ten letter assignments must use distinct digits, obey leading-digit rules, satisfy both equations, and match SAREE, the quotient, and the decoded word.

Incorrect or incomplete stages award no score or power-ups. A stage can only be submitted after all earlier stages are accepted. Accepted answers are saved and locked. The final accepted stage completes the round automatically; finishing early records only already accepted stages. Expiration locks the round using server time. Duplicate requests cannot award a stage twice.

Network errors never create an offline acceptance. If a response is lost after the server saved an answer, the client recovers the stored result from the attempt endpoint. A failed save returns an error before acceptance is displayed. Dataset writes use an atomic file replacement.

The Hashi board supports click, tap, drag, keyboard island selection, bridge removal, guides, undo, redo, and clear. Drafts are restored after refresh. The officers board uses select-and-place controls, including selecting an occupied cell to move its officer.

## Power-ups and administration

Accepted challenges unlock 2, 4, and 5 power-ups respectively. After a round ends, select exactly two from the earned pool. Confirmation permanently locks the choices.

Administrator views provide challenge previews, leaderboard, searchable dataset, power-up overview, room settings, and CSV/JSON/Excel exports. Polling refreshes reports every ten seconds. Authentication is enforced on the server, including exports and dataset mutations.

Set `ADMIN_PASSWORD` for administrator access. Otherwise, the server uses `admin_password` in `data/room_config.json`, with `admin123` as the development fallback. Administrator sessions expire after eight hours or a server restart; contestant session tokens remain associated with their saved attempts. Passwords are excluded from public room configuration.

Round 2 uses fixed track puzzles and a fixed 30-minute limit. Legacy default-room puzzle and time settings are retained for administration but do not override Round 2 rules.

## Tests

```bash
npm test
npm run build
```

Tests cover the actual server validators, authenticated API flows for both tracks, malformed and partial answers, sequence locks, deadline enforcement, replay prevention, persistence failures, React state transitions, and server-side rendering of components. They do not open a browser. API tests bind a temporary localhost port and use a separate temporary dataset; they never modify `data/dataset.json`.

The old `scripts/test_*.js` and `scripts/verify_all_requirements.js` entry points now run the production validators or the current test suite instead of duplicating validation logic.

## Structure

```text
src/
  App.jsx                  Session, round navigation, timer, and request lifecycle
  state.js                 Round reducer; drafts cannot grant acceptance
  api.js                   API and browser-storage helpers
  components/              React challenge, board, power-up, auth, and admin views
server/
  validation.cjs           Server-only strict challenge validators
  round2.cjs               Authenticated round lifecycle and power-up selection
server.js                  Express app, challenge configuration, reports, and exports
public/                    HTML entry point and existing styles
scripts/build.cjs          React production build
scripts/dev.cjs            React watch build and development server
tests/                     Validator, API, reducer, and render tests
data/                      Persistent dataset, room settings, and puzzle bank
```

`DATA_DIR` can point to an alternate directory containing `dataset.json`, `puzzles.json`, and `room_config.json`. The JSON datastore is intended for one server process; use a transactional database before running multiple writer processes or replicas.

## Migration notes

The old DOM managers have been replaced with React components. Express remains the backend so validation and answer keys stay off the client. The browser bundle does not include puzzle solutions or server validators.

New contestant sessions use `/api/round2/start`, `/api/round2/attempt/:id`, `/api/round2/validate-stage`, `/api/round2/submit`, and `/api/round2/select-powerups`, with a bearer token from the start response. Old `/api/student/*` mutations and `/api/track2/{start,validate-stage,submit}` return HTTP 410; they cannot bypass the new workflow. Final submission only finalizes stored accepted answers; clients must validate each stage first.

Legacy browser sessions must start a new authenticated attempt. Existing dataset records remain available for reporting and are not retroactively regraded. The demo seeder (`npm run seed`) replaces sample data; use it only when intended.
