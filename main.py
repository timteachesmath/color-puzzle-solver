"""
Orchestrates the daily pipeline:
    1. Find today's puzzle post (PRAW)
    2. Extract the board state (Playwright)
    3. Solve it (your A* solver)
    4. Write the result to site/solutions/YYYY-MM-DD.json

Run locally with:  python main.py
"""

import json
from datetime import date
from pathlib import Path

from scraper.fetch_post import get_latest_puzzle_url
from scraper.extract_board import fetch_board_from_url, validate_board
from solver.astar import solve

OUTPUT_DIR = Path("site/solutions")


def run() -> None:
    print("Finding today's puzzle post...")
    url = get_latest_puzzle_url()
    print(f"  -> {url}")

    print("Extracting board state...")
    board = fetch_board_from_url(url)
    validate_board(board)
    print(f"  -> {board}")

    print("Solving...")
    moves = solve(board)
    print(f"  -> {len(moves)} moves")

    today = date.today().isoformat()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / f"{today}.json"

    payload = {
        "date": today,
        "source_url": url,
        "board": board,
        "moves": [m.to_dict() for m in moves],
    }

    with open(output_path, "w") as f:
        json.dump(payload, f, indent=2)

    print(f"Wrote solution to {output_path}")


if __name__ == "__main__":
    run()
