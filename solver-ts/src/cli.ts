/**
 * Node entry point used by main.py: reads a board (JSON, same shape as the
 * daily JSON's `board` field) from stdin, writes solved moves (JSON) to
 * stdout. Non-zero exit + a message on stderr on failure.
 */

import { solveBoard, type Board } from "./solver.js";

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function main() {
  const raw = await readStdin();
  const board: Board = JSON.parse(raw);
  const moves = solveBoard(board);
  process.stdout.write(JSON.stringify(moves));
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
