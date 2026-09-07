/**
 * Color-sort puzzle solver. A* search over pour moves.
 * TypeScript so the browser (site/index.html) and
 * the daily pipeline (main.py, via cli.ts) share one implementation
 * instead of two hand-kept-in-sync copies.
 */

/** Array of tubes. Each tube is an array of strings where the user can interact with the last nonempty element in each tube. */
export type Board = string[][];
export type Move = { from: number; to: number; color: string };


/**
 * Solve a puzzle board (raw top-slot-first order, same shape as the daily
 * JSON's `board` field). Throws if no solution is found or the search
 * exceeds `timeBudgetMs`.
 */
export function solveBoard(board: Board, timeBudgetMs = 8000, tubeDepth?: number): Move[] {
  const deadline = Date.now() + timeBudgetMs;
  // Depth can be given explicitly (needed if, say, the board happens to be
  // all-empty and there's nothing to infer from); otherwise infer it from
  // the longest tube present, which handles both already-uniform boards
  // and ragged ones (e.g. empty tubes arriving as `[]`).
  const depth = tubeDepth ?? Math.max(...board.map((tube) => tube.length));

  const heap = new IndexMinHeap<PuzzleState>();
  const used = new Set<string>();

  const normalizedBoard = board.map((tube) =>
    tube.length < depth ? padTube(tube, depth) : tube
  );
  const tubes: Tube[] = normalizedBoard.map((tube) => new Tube(tube));

  const initialPuzzleState = new PuzzleState(tubes, depth);
  heap.insert([initialPuzzleState.g + initialPuzzleState.h, initialPuzzleState.g, initialPuzzleState]);

  let currentItem: HeapItem<PuzzleState> | null;

  while ((currentItem = heap.poll()) !== null) {
    if (Date.now() > deadline) throw new Error("TIMEOUT");

    const state = currentItem[2];
    const canonicalForm = getCanonicalForm(state.tubes);
    if (used.has(canonicalForm)) continue;   // stale duplicate — skip it

    used.add(canonicalForm);
    if (state.h === 0) return unravelMoves(state);

    const tubeCount = state.tubes.length;

    for (let i = 0; i < tubeCount - 1; i++) {
      for (let j = i + 1; j < tubeCount; j++) {
        let newState = tryMove(i, j, state, used, depth);
        if (newState) {
          heap.insert(newState);
        }

        newState = tryMove(j, i, state, used, depth);
        if (newState) {
          heap.insert(newState);
        }
      }
    }
  }

  throw new Error("No solution found for this puzzle.");
}

function tryMove(i: number, j: number, currentState: PuzzleState, used: Set<string>, tubeDepth: number): HeapItem<PuzzleState> | undefined {
  const tubes = currentState.tubes;
  if (isLegalMove(tubes[i], tubes[j])) {
    const newTubes = doMove(tubes, i, j, tubeDepth);
    const canonicalTubes = getCanonicalForm(newTubes);
    if (!used.has(canonicalTubes)) {
      const move = { from: i, to: j, color: tubes[i].color };
      const newState = new PuzzleState(newTubes, tubeDepth, currentState, move);
      return [newState.g + newState.h, newState.g, newState];
    }
  }

  return undefined
}

function unravelMoves(state: PuzzleState): Move[] {
  let ret: Move[] = [];

  let currentState: PuzzleState | null = state;
  while (currentState && currentState.move) {
    ret.push(currentState.move);
    currentState = currentState.previousState;
  }

  return ret.reverse();
}

function isLegalMove(i: Tube, j: Tube): boolean {
  if (i.capacityUsed === 0) { return false; }
  if (j.color && i.color !== j.color) { return false; }
  if (i.colorLength > j.capacityTotal - j.capacityUsed) { return false; }

  return true;
}

export function doMove(tubes: Tube[], i: number, j: number, tubeDepth: number): Tube[] {
  const ret = tubes.slice();
  const segmentLength = ret[i].colorLength;

  const jUsed = ret[j].aryTube.slice(0, ret[j].capacityUsed).concat(Array(segmentLength).fill(ret[i].color));
  const jTube = padTube(jUsed, tubeDepth);

  const iUsed = ret[i].aryTube.slice(0, ret[i].capacityUsed - segmentLength);
  const iTube = padTube(iUsed, tubeDepth);

  ret[i] = new Tube(iTube);
  ret[j] = new Tube(jTube);

  return ret;
}

function padTube(tube: string[], length: number): string[] {
  return tube.concat(Array(Math.max(0, length - tube.length)).fill(""));
}

function getCanonicalForm(tubes: Tube[]): string {
  return tubes.map((tube) => tube.toString()).sort().join("|");
}

/** A_star heuristic, A_star heuristic spent portion, payload */
export type HeapItem<T = unknown> = [number, number, T];

/** Heap implementation for TypeScript. */
export class IndexMinHeap<T = unknown> {
  private heap: HeapItem<T>[] = [];

  private getParentIndex(i: number): number { return Math.floor((i - 1) / 2); }
  private getLeftChildIndex(i: number): number { return 2 * i + 1; }
  private getRightChildIndex(i: number): number { return 2 * i + 2; }

  private swap(i1: number, i2: number): void {
    const temp = this.heap[i1];
    this.heap[i1] = this.heap[i2];
    this.heap[i2] = temp;
  }

  private compare(item1: HeapItem<T>, item2: HeapItem<T>): number {
    // Primary sort: Compare index 0
    if (item1[0] !== item2[0]) {
      return item1[0] - item2[0];
    }
    // Secondary sort: Compare index 1
    return item1[1] - item2[1];
  }

  public insert(item: HeapItem<T>): void {
    this.heap.push(item);
    this.heapifyUp();
  }

  private heapifyUp(): void {
    let index = this.heap.length - 1;
    while (index > 0) {
      const parentIdx = this.getParentIndex(index);
      if (this.compare(this.heap[index], this.heap[parentIdx]) < 0) {
        this.swap(index, parentIdx);
        index = parentIdx;
      } else {
        break;
      }
    }
  }

  public poll(): HeapItem<T> | null {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop()!;

    const min = this.heap[0];
    const last = this.heap.pop()!;

    // Explicitly check to ensure we aren't putting the element back
    // if pop() emptied the array
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.heapifyDown();
    }

    return min;
  }

  private heapifyDown(): void {
    let index = 0;
    while (this.getLeftChildIndex(index) < this.heap.length) {
      let smallerChildIndex = this.getLeftChildIndex(index);
      const rightChildIndex = this.getRightChildIndex(index);

      if (
        rightChildIndex < this.heap.length &&
        this.compare(this.heap[rightChildIndex], this.heap[smallerChildIndex]) < 0
      ) {
        smallerChildIndex = rightChildIndex;
      }

      if (this.compare(this.heap[index], this.heap[smallerChildIndex]) <= 0) {
        break;
      }

      this.swap(index, smallerChildIndex);
      index = smallerChildIndex;
    }
  }

  public peek(): HeapItem<T> | null {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  public size(): number {
    return this.heap.length;
  }
}

export class Tube {
  public readonly aryTube: string[];
  public readonly capacityTotal: number;
  public readonly capacityUsed: number;
  public readonly segments: number;
  public readonly color: string;
  public readonly colorLength: number;

  constructor(aryTube: string[]) {
    this.aryTube = aryTube;
    this.capacityTotal = aryTube.length;

    let used = 0;
    let segments = 0;
    aryTube.forEach((pill, n) => {
      if (pill) {
        used += 1;
        if (n == 0) { segments += 1; }
        if (n < this.capacityTotal - 1 && aryTube[n + 1] && pill != aryTube[n + 1]) {
          segments += 1;
        }
      }
    });

    this.capacityUsed = used;
    this.segments = segments;
    if (used) {
      this.color = aryTube[used - 1];
      let colorLength = 0;
      for (let i = used - 1; i >= 0; i--) {
        if (aryTube[i] === this.color) { colorLength += 1; }
        else { break; }
      }
      this.colorLength = colorLength;
    }
    else {
      this.color = "";
      this.colorLength = 0;
    }
  }

  toString(): string {
    return this.aryTube.join("");
  }

}

class PuzzleState {
  public readonly tubes: Tube[];
  public readonly previousState: PuzzleState | null;
  public readonly move: Move | null;
  public readonly g: number; // can be calculated from parent
  public readonly h: number; // can be calculated from board

  constructor(
    tubes: Tube[],
    depth: number,
    previousState?: PuzzleState | null,
    move?: Move | null
  ) {
    if (previousState) {
      this.g = previousState.g + 1;
    }
    else {
      this.g = 0;
    }

    this.tubes = tubes;

    this.previousState = previousState || null;
    this.move = move || null;
    this.h = getTubesHeuristic(tubes, depth);
  }
}

/** The minimum number of moves necessary to join all segments to fill monochromatic tubes  */
function getTubesHeuristic(tubes: Tube[], tubeSize: number): number {
  let segments = 0;
  let filled = 0;
  for (const tube of tubes) {
    segments += tube.segments;
    filled += tube.capacityUsed;
  }

  const idealSegments = Math.floor(filled / tubeSize)
  return segments - idealSegments;
}

/** Rapid prototyping */
if (import.meta.main) {
  // const x = [["A", "A", "B", "C"], ["A", "B", "", ""], ["A", "A", "", ""], ["A", "B", "B", ""], ["A", "B", "C", "D"], ["", "", "", ""]];

  // console.log("total", "used", "segments", "color", "colorLength");
  // x.forEach(y => {
  //   const z = new Tube(y);
  //   console.log(z.capacityTotal, z.capacityUsed, z.segments, z.color, z.colorLength, z.aryTube);
  // });

  console.log(solveBoard([
    [
      "B",
      "B",
      "C",
      "Y"
    ],
    [
      "G",
      "Y",
      "C",
      "G"
    ],
    [
      "B",
      "O",
      "C",
      "M"
    ],
    [
      "P",
      "L",
      "Y",
      "L"
    ],
    [
      "G",
      "O",
      "R",
      "O"
    ],
    [
      "Y",
      "M",
      "L",
      "G"
    ],
    [
      "W",
      "W",
      "C",
      "B"
    ],
    [
      "P",
      "M",
      "R",
      "P"
    ],
    [
      "L",
      "P",
      "W",
      "O"
    ],
    [
      "R",
      "W",
      "R",
      "M"
    ],
    ["", "", "", ""],
    ["", "", "", ""]]));
}
