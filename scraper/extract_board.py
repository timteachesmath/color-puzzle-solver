"""
Load a Color Puzzle Reddit post with Playwright and extract the board
state directly from the rendered DOM.

The game itself renders inside a Devvit webview iframe, not the top-level
Reddit page — extract_board() searches iframes if nothing is found at the
top level. It also has a colorblind-mode toggle (button with the title
"Toggle colorblind mode - show letters on colors") that writes the color's
single-letter code directly into each slot's DOM as a <span>, so we read
that instead of parsing rgb() fills — it's exactly the letter alphabet the
solver expects, and isn't tied to a fixed, guessed set of colors the puzzle
might add to over time.

Run standalone for testing:
    python -m scraper.extract_board "https://www.reddit.com/r/ColorPuzzleGame/comments/<id>/"
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, Page
from playwright_stealth import Stealth

load_dotenv()

# Anonymous headless traffic gets a reCAPTCHA wall from Reddit — this must
# point at a session saved by `python -m scraper.auth`.
STORAGE_STATE_PATH = Path(os.environ.get("REDDIT_STORAGE_STATE_PATH", "reddit_state.json"))

TUBE_SELECTOR = 'div[role="button"]'
SLOT_SELECTOR = ".absolute > div"
COLORBLIND_TOGGLE_SELECTOR = 'button[title="Toggle colorblind mode - show letters on colors"]'


def _extract_from_context(ctx) -> list[list[str]]:
    """ctx is either a Page or a Frame — both support query_selector-style calls."""
    toggle = ctx.query_selector(COLORBLIND_TOGGLE_SELECTOR)
    if toggle:
        toggle.click()
        ctx.wait_for_timeout(300)  # letters render a beat after the click

    tubes = ctx.query_selector_all(TUBE_SELECTOR)
    board = []
    for tube in tubes:
        slots = tube.query_selector_all(SLOT_SELECTOR)
        colors = []
        for slot in slots:
            span = slot.query_selector("span")
            if span:
                colors.append(span.text_content().strip())
        board.append(colors)
    return board


def extract_board(page: Page) -> list[list[str]]:
    """
    Try extracting directly from the page first. If nothing meaningful is
    found (likely because the game renders inside an iframe), fall back to
    searching iframes on the page.
    """
    board = _extract_from_context(page)
    if any(board):
        return board

    for frame in page.frames:
        try:
            board = _extract_from_context(frame)
            if any(board):
                return board
        except Exception:
            continue

    raise RuntimeError(
        "Could not find any tubes with content on the page or in any iframe. "
        "Inspect the live DOM again — selectors or structure may have changed."
    )


def fetch_board_from_url(url: str, headless: bool = True) -> list[list[str]]:
    if not STORAGE_STATE_PATH.exists():
        raise RuntimeError(
            f"No saved Reddit session at {STORAGE_STATE_PATH}. "
            "Run `python -m scraper.auth` first — anonymous requests get a "
            "reCAPTCHA wall instead of the puzzle page."
        )

    with Stealth().use_sync(sync_playwright()) as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
            storage_state=str(STORAGE_STATE_PATH),
        )
        page = context.new_page()
        page.goto(url, timeout=30000)
        page.wait_for_timeout(4000)  # let the Devvit game iframe finish loading
        board = extract_board(page)
        browser.close()
        return board

def validate_board(board: list[list[str]], expected_depth: int = 4) -> None:
    """
    Raise loudly if the parsed board doesn't look like a valid puzzle:
    every color should appear exactly `expected_depth` times total, and
    the number of distinct colors should match the number of filled tubes
    (i.e. one color per completed tube, plus empties).
    """
    from collections import Counter

    counts = Counter(color for tube in board for color in tube)
    bad_counts = {c: n for c, n in counts.items() if n != expected_depth}
    if bad_counts:
        raise ValueError(
            f"Invalid board parse: expected every color to appear "
            f"{expected_depth} times, but got {bad_counts}. "
            f"Inspect the live DOM — extraction may have missed or duplicated slots."
        )

    filled_tubes = sum(1 for tube in board if tube)
    if len(counts) != filled_tubes:
        raise ValueError(
            f"Invalid board parse: {len(counts)} distinct colors but "
            f"{filled_tubes} filled tubes — these should match."
        )

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m scraper.extract_board <post_url>")
        sys.exit(1)
    result = fetch_board_from_url(sys.argv[1], headless=False)
    validate_board(result)
    for i, tube in enumerate(result):
        print(f"Tube {i}: {tube}")
