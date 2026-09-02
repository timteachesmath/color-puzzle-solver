"""
One-time interactive login to capture an authenticated Reddit session.

Anonymous headless Playwright traffic gets served a reCAPTCHA wall by
Reddit ("Prove your humanity") on both listing and post pages — a logged-in
session avoids it. Run this whenever fetch_post.py / extract_board.py start
failing with the "no saved Reddit session" / selector-timeout errors, since
the saved session will eventually expire:

    python -m scraper.auth

A real (non-headless) browser window opens to the Reddit login page. Log in
manually — enter credentials, solve any CAPTCHA/2FA yourself — then return
to this terminal and press Enter once you're on your Reddit homepage.
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


def login() -> None:
    with Stealth().use_sync(sync_playwright()) as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1280, "height": 800},
        )
        page = context.new_page()
        page.goto("https://www.reddit.com/login")

        input(
            "Log in manually in the opened browser window, then press Enter "
            "here once you're on your Reddit homepage..."
        )

        context.storage_state(path=str(STORAGE_STATE_PATH))
        browser.close()

    print(f"Saved session to {STORAGE_STATE_PATH}")


if __name__ == "__main__":
    login()
