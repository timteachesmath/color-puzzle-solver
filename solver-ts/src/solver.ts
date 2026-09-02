/**
 * Color-sort puzzle solver — ported from solver/astar.py's breadthFirst,
 * algorithm unchanged. TypeScript so the browser (site/index.html) and the
 * daily pipeline (main.py, via cli.ts) share one implementation instead of
 * two hand-kept-in-sync copies.
 *
 * Shape requirement (same as astar.py): tube depth 4, and the board's last
 * two tubes must be empty — the algorithm's goal-move-count formula is
 * derived from that fixed layout.
 */

const TUBE_DEPTH = 4;

export type Board = string[][];
export type Move = { from: number; to: number; color: string };

type Tubes = string[];

function doOneMove(tubes: Tubes, x: [number, number]): Tubes {
  const a = tubes[x[0]];
  const b = tubes[x[1]];
  let i = 0;
  while (a.length > i + 1 && a[i + 1] === a[i] && i + 1 + b.length < TUBE_DEPTH) {
    i += 1;
  }
  const r = tubes.slice();
  r[x[1]] = a.slice(0, i + 1) + b;
  r[x[0]] = a.slice(i + 1);
  return r;
}

function getDepth(tube: string): number {
  if (tube.length === 0) return 0;
  let d = 1;
  while (tube.length > d && tube[0] === tube[d]) d += 1;
  return d;
}

function oneColorTube(tube: string): boolean {
  return getDepth(tube) === tube.length;
}

function getKey(tubes: Tubes): string {
  return tubes.join("|");
}

function getSetSig(tubes: Tubes): string {
  return tubes.slice().sort().join("|");
}

function getTubesFromKey(key: string): Tubes {
  return key.split("|");
}

type MoveHistory = Array<[number, number]>;

function breadthFirstSolve(tubes: Tubes, timeBudgetMs: number): MoveHistory | null {
  const deadline = Date.now() + timeBudgetMs;

  function getAllMoves(
    n: number,
    goal: number,
    dictionaries: Array<Array<Record<string, MoveHistory>>>,
    sets: Set<string>[]
  ): number {
    let newEntries = 0;
    for (let j = 0; j <= n; j++) {
      const i = n - j;
      if (j === 0) dictionaries.push([{}]);
      dictionaries[i].push({});
      sets.push(new Set());

      const currentDict = dictionaries[i][j];
      for (const k of Object.keys(currentDict)) {
        const tubesState = getTubesFromKey(k);
        const starts = new Map<string, number[]>();
        let lastEmpty = -1;

        tubesState.forEach((tube, t) => {
          if (tube.length === 0) {
            lastEmpty = t;
            return;
          }
          const c0 = tube[0];
          if (!starts.has(c0)) starts.set(c0, []);
          starts.get(c0)!.push(t);
        });

        for (const c of starts.values()) {
          for (const v of c) {
            for (const w of c) {
              if (v === w) continue;
              if (tubesState[w].length === 4) continue;

              const m: [number, number] = [v, w];
              const mm = currentDict[k].concat([m]);
              const tt = doOneMove(tubesState, m);
              const newKey = getKey(tt);
              const newSetSig = getSetSig(tt);

              if (getDepth(tubesState[v]) + tubesState[w].length <= 4) {
                if (!sets[i + 1].has(newSetSig)) {
                  dictionaries[i + 1][j][newKey] = mm;
                  sets[i + 1].add(newSetSig);
                  newEntries += 1;
                  if (i + 1 === goal) return -1;
                }
              } else if (!sets[i].has(newSetSig)) {
                dictionaries[i][j + 1][newKey] = mm;
                sets[i].add(newSetSig);
                newEntries += 1;
              }
            }

            if (oneColorTube(tubesState[v]) || lastEmpty === -1) continue;

            const m: [number, number] = [v, lastEmpty];
            const mm = currentDict[k].concat([m]);
            const tt = doOneMove(tubesState, m);
            const newKey = getKey(tt);
            const newSetSig = getSetSig(tt);

            if (!sets[i].has(newSetSig)) {
              dictionaries[i][j + 1][newKey] = mm;
              sets[i].add(newSetSig);
              newEntries += 1;
            }
          }
        }
      }
      if (Date.now() > deadline) throw new Error("TIMEOUT");
    }
    return newEntries;
  }

  function solveOne(tubes: Tubes): MoveHistory | null {
    let n = 0;
    let pieces = 0;
    for (const tube of tubes.slice(0, -2)) {
      pieces += 1;
      for (let i = 0; i < 3; i++) {
        if (tube[i] !== tube[i + 1]) pieces += 1;
      }
    }
    const goal = pieces - tubes.length + 2;

    const dictionaries: Array<Array<Record<string, MoveHistory>>> = [[{}]];
    dictionaries[0][0][getKey(tubes)] = [];
    const sets: Set<string>[] = [new Set([getSetSig(tubes)])];

    while (getAllMoves(n, goal, dictionaries, sets) > 0) n += 1;

    if (goal < dictionaries.length) {
      for (const dictAtJ of dictionaries[goal]) {
        const keys = Object.keys(dictAtJ);
        if (keys.length > 0) return dictAtJ[keys[0]];
      }
    }
    return null;
  }

  return solveOne(tubes);
}

/**
 * Solve a puzzle board (raw top-slot-first order, same shape as the daily
 * JSON's `board` field). Throws if no solution is found or the search
 * exceeds `timeBudgetMs`.
 */
export function solveBoard(board: Board, timeBudgetMs = 8000): Move[] {
  const tubes: Tubes = board.map((tube) => tube.slice().reverse().join(""));
  const soln = breadthFirstSolve(tubes, timeBudgetMs);
  if (soln === null) throw new Error("No solution found for this puzzle.");

  let state = tubes.slice();
  const moves: Move[] = [];
  for (const [frm, to] of soln) {
    const color = state[frm][0];
    moves.push({ from: frm, to, color });
    state = doOneMove(state, [frm, to]);
  }
  return moves;
}
