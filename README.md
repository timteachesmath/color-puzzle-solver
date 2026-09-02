# Color Puzzle Solver

Finds the daily r/ColorPuzzleGame post, scrapes the puzzle's board state,
solves it, and publishes the solution to a static site.

## How it works

Reddit closed self-service API registration in late 2025 (the
"Responsible Builder Policy"), and anonymous headless-browser requests get
served a reCAPTCHA wall — so this doesn't use PRAW/OAuth. Instead:

1. `scraper/auth.py` — one-time interactive login that saves an
   authenticated Playwright session to `reddit_state.json`.
2. `scraper/fetch_post.py` — reuses that session to find the newest post
   in the subreddit.
3. `scraper/extract_board.py` — loads the post (the game itself renders
   inside a Devvit webview iframe), clicks the puzzle's colorblind-mode
   toggle so it writes each color's letter code directly into the DOM,
   and reads those letters into a board.
4. `solver-ts/src/solver.ts` — the actual search algorithm (compiled to
   `site/js/solver.js`). `solver/astar.py` shells out to the compiled
   Node CLI (`site/js/cli.js`, from `solver-ts/src/cli.ts`) rather than
   reimplementing it in Python, so the daily pipeline and the browser
   share one implementation instead of two hand-kept-in-sync copies.
5. `main.py` — runs 1–4 and writes `site/solutions/YYYY-MM-DD.json`.
6. `site/index.html` — static page that fetches today's JSON and renders
   the moves, and also imports `site/js/solver.js` directly (as an ES
   module) to power the "Solve Your Own Puzzle" field. No Reddit calls
   happen client-side — it only ever reads a same-origin JSON file.

## Setup (local)

```bash
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
cp .env.example .env       # defaults are fine unless you want a different subreddit
```

Build the shared TypeScript solver (needed before `main.py` or `site/index.html` will work — both depend on `site/js/solver.js` / `site/js/cli.js`):

```bash
npm install -g typescript   # global install — see note below
cd solver-ts
npm run build                # compiles src/*.ts to ../site/js/*.js
cd ..
```

**Global install, not local:** a local `npm install` inside `solver-ts/`
reliably corrupts (0-byte files in `node_modules`) in this Google
Drive-synced folder — Drive's sync appears to interfere with npm's rapid
small-file writes during extraction. Installing TypeScript globally
(outside the synced folder, under npm's global prefix) avoids it. Rerun
`npm run build` in `solver-ts/` any time you change `solver-ts/src/*.ts`.

Then create your authenticated session (needed before anything else will
work — anonymous requests get blocked):

```bash
python -m scraper.auth
```

A real browser window opens to the Reddit login page. Log in manually
(credentials, 2FA, CAPTCHA — whatever it asks), then press Enter in the
terminal once you're on your homepage. This saves `reddit_state.json`,
which `fetch_post.py` and `extract_board.py` both reuse. **Never commit
this file** — it's login session data (already in `.gitignore`). It will
expire eventually; re-run `scraper.auth` when things start failing with a
"no saved Reddit session" or CAPTCHA-related error.

Run the full pipeline:

```bash
python main.py
```

This writes `site/solutions/YYYY-MM-DD.json`. Open `site/index.html`
directly (or serve `site/` locally) to see it rendered.

