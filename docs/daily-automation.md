# Daily automation (Windows Task Scheduler)

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
scheduled run's log shows a failure related to it, re-run `python -m scraper.auth`
as described in the [README](../README.md#setup-local).

