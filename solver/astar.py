"""
Solver entry point used by main.py.

The search algorithm itself lives in solver-ts/src/solver.ts (compiled to
site/js/solver.js / site/js/cli.js), so the browser (site/index.html) and
this pipeline share one implementation instead of two hand-kept-in-sync
copies. This module just shells out to the compiled Node CLI and reshapes
the result into Move objects.

Board representation:
    list[list[str]] — one list per tube, top-slot-first (matching what
    extract_board.py produces). Shape requirement: tube depth 4, and the
    last two tubes must be empty (see solver-ts/src/solver.ts).

Requires Node on PATH and solver-ts built (`npm run build` in solver-ts/,
which needs `tsc` — see solver-ts/README or the project README for the
global-install note).
"""

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

from tests.load_fixture import load_fixture

CLI_PATH = Path(__file__).resolve().parent.parent / "site" / "js" / "cli.js"


@dataclass
class Move:
    from_tube: int
    to_tube: int
    color: str

    def to_dict(self) -> dict:
        return {"from": self.from_tube, "to": self.to_tube, "color": self.color}


def solve(board: list[list[str]]) -> list[Move]:
    """
    Args:
        board: current tube state, e.g. [["O","P","L","P"], ["L","C","M","Y"], ...]

    Returns:
        Ordered list of Moves that solves the puzzle (each tube same color, or empty).
    """
    if not CLI_PATH.exists():
        raise RuntimeError(
            f"{CLI_PATH} not found. Run `npm run build` in solver-ts/ first."
        )

    result = subprocess.run(
        ["node", str(CLI_PATH)],
        input=json.dumps(board),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"solver-ts CLI failed: {result.stderr.strip()}")

    return [Move(m["from"], m["to"], m["color"]) for m in json.loads(result.stdout)]


if __name__ == "__main__":
    # Quick smoke test against the sample fixture.
    board = load_fixture("sample_board_1.json")
    moves = solve(board)
    print([m.to_dict() for m in moves])
