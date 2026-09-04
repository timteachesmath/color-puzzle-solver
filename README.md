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

## Running the tests

```bash
cd solver-ts
npm test
```

Runs `solver-ts/src/solver.test.ts` via Node's built-in test runner
(`node --test` — no test framework dependency needed). Covers `solveBoard`
(exact move counts on known boards, each independently verified by
replaying the moves and confirming the board actually ends up sorted, plus
edge cases like an already-solved board and the search timeout) and
`IndexMinHeap` (ordering, tie-breaking, size tracking). Test files are
excluded from `tsc`'s build (`solver-ts/tsconfig.json`), so they never end
up in the deployed `site/js/`.

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

## Daily automation (Windows Task Scheduler)

This runs locally on a schedule rather than in GitHub Actions — the
pipeline needs the authenticated `reddit_state.json` session, and keeping
that on your own machine (instead of uploading it as a CI secret) avoids
handing Reddit session/login data to a third-party service.

`scripts/run_daily.ps1` runs the full pipeline (`main.py`) and, if it
produced a new solution, commits and pushes `site/solutions/*.json` —
which in turn triggers `.github/workflows/pages.yml` to redeploy the live
site. Everything it does gets appended to `logs/daily_run.log` (gitignored)
since there's no console to watch when it runs unattended.

To schedule it:

1. Open Task Scheduler (Start menu → search "Task Scheduler").
2. **Create Task...** (not "Create Basic Task" — the full dialog gives
   more control):
   - **General**: name it something like "Color Puzzle Solver Daily Run".
     Check "Run whether user is logged on or not" if you want it to run
     even when locked/logged out.
   - **Triggers** → New: Daily, at a time comfortably after the puzzle
     usually posts.
   - **Actions** → New: Action = "Start a program", Program/script =
     `powershell.exe`, Add arguments = `-NoProfile -ExecutionPolicy Bypass -File "G:\My Drive\pro\puzzleSolver\scripts\run_daily.ps1"`.
   - **Settings**: check "Run task as soon as possible after a scheduled
     start is missed" (covers the machine being asleep/off at the
     scheduled time).
3. Save, then right-click the task → **Run** once to test it, and check
   `logs/daily_run.log` for a clean `=== Run succeeded ===` line.

**If you sign into Windows with a Microsoft account:** "Run whether user
is logged on or not" needs a real local-account-style password, which a
Microsoft account sign-in doesn't expose in a form Task Scheduler can use.
Workaround: temporarily switch Windows sign-in to a local account (Settings
→ Accounts → Your info → "Sign in with a local account instead") — this
forces you to set a password for it. Use that password when Task Scheduler
prompts for credentials, then switch your sign-in back to the Microsoft
account afterward; the local account and its password stay valid, and
Task Scheduler keeps using them.

**Note:** an unattended `git push` needs stored credentials — this only
works if `git`/`gh` already has cached credentials for your GitHub account
on this machine (true if you've been pushing manually already). If the
push step ever fails with an auth error, re-run `gh auth login`.

The session in `reddit_state.json` will still expire eventually — when the
scheduled run's log shows a failure related to it, re-run `scraper.auth`
as described above.

