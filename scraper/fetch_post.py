"""
Find the most recent puzzle post using an authenticated Playwright session.

Reddit's self-service API registration is closed (Responsible Builder
Policy, Nov 2025) and anonymous headless requests get served a reCAPTCHA
wall, so this no longer uses PRAW/OAuth — it reuses the browser session
saved by `python -m scraper.auth`.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth

load_dotenv()

STORAGE_STATE_PATH = Path(os.environ.get("REDDIT_STORAGE_STATE_PATH", "reddit_state.json"))
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

# TODO: unverified — Reddit's reCAPTCHA wall blocked inspection of the live
# listing DOM even with a stealth browser. Once scraper.auth has produced a
# working session, re-check this selector against
# https://www.reddit.com/r/<subreddit>/new/ (modern Reddit renders posts as
# <shreddit-post> custom elements; this targets its permalink attribute).
POST_LINK_SELECTOR = "shreddit-post"


def get_latest_puzzle_url(subreddit_name: str | None = None) -> str:
    """
    Return the full URL of the most recent post in the subreddit.
    Assumes the daily puzzle is always the newest post — adjust the
    filter below (e.g. title matching "Daily Color Puzzle") if the sub
    ever posts other content too.
    """
    subreddit_name = subreddit_name or os.environ.get("SUBREDDIT_NAME", "ColorPuzzleGame")

    if not STORAGE_STATE_PATH.exists():
        raise RuntimeError(
            f"No saved Reddit session at {STORAGE_STATE_PATH}. "
            "Run `python -m scraper.auth` first."
        )

    with Stealth().use_sync(sync_playwright()) as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1280, "height": 800},
            storage_state=str(STORAGE_STATE_PATH),
        )
        page = context.new_page()
        page.goto(f"https://www.reddit.com/r/{subreddit_name}/new/", timeout=30000)
        page.wait_for_selector(POST_LINK_SELECTOR, timeout=15000)

        post = page.query_selector(POST_LINK_SELECTOR)
        permalink = post.get_attribute("permalink") or post.get_attribute("content-href")

        browser.close()

    if not permalink:
        raise RuntimeError(
            f"Found `{POST_LINK_SELECTOR}` but couldn't read its permalink — "
            "inspect the live DOM and fix POST_LINK_SELECTOR / the attribute lookup."
        )

    if permalink.startswith("/"):
        permalink = f"https://www.reddit.com{permalink}"
    return permalink


if __name__ == "__main__":
    print(get_latest_puzzle_url())
