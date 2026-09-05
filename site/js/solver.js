/**
 * Color-sort puzzle solver — A* search over pour moves, using a binary
 * heap ordered by f = g + h and a canonical (order-independent) closed
 * set to dedupe states. TypeScript so the browser (site/index.html) and
 * the daily pipeline (main.py, via cli.ts) share one implementation
 * instead of two hand-kept-in-sync copies.
 *
 * Tube depth is inferred from the board (or given explicitly via
 * `solveBoard`'s `tubeDepth` argument) — unlike the algorithm this
 * replaced, there's no assumption about how many tubes are empty or
 * where they sit.
 */
const TUBE_DEPTH = 4;
// Kept independently of the A* implementation below — solver.test.ts uses
// this to replay and verify solveBoard's output via a completely separate
// code path, rather than trusting the algorithm to check its own work.
export function doOneMove(tubes, x) {
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
/**
 * Solve a puzzle board (raw top-slot-first order, same shape as the daily
 * JSON's `board` field). Throws if no solution is found or the search
 * exceeds `timeBudgetMs`.
 */
export function solveBoard(board, timeBudgetMs = 8000, tubeDepth) {
    const deadline = Date.now() + timeBudgetMs;
    // Depth can be given explicitly (needed if, say, the board happens to be
    // all-empty and there's nothing to infer from); otherwise infer it from
    // the longest tube present, which handles both already-uniform boards
    // and ragged ones (e.g. empty tubes arriving as `[]`).
    const depth = tubeDepth ?? Math.max(...board.map((tube) => tube.length));
    const heap = new IndexMinHeap;
    const used = new Set();
    const normalizedBoard = board.map((tube) => tube.length < depth ? tube.concat(Array(depth - tube.length).fill("")) : tube);
    const tubes = normalizedBoard.map((tube) => new Tube(tube));
    const initialPuzzleState = new PuzzleState(tubes);
    heap.insert([initialPuzzleState.g + initialPuzzleState.h, initialPuzzleState.g, initialPuzzleState]);
    while (heap.size() > 0) {
        if (Date.now() > deadline)
            throw new Error("TIMEOUT");
        const currentItem = heap.poll();
        const state = currentItem[2];
        const canonicalForm = getCanonicalForm(state.tubes);
        if (used.has(canonicalForm))
            continue; // stale duplicate — skip it
        used.add(canonicalForm);
        if (state.h === 0)
            return unravelMoves(state);
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
function tryMove(i, j, currentState, used, tubeDepth) {
    const tubes = currentState.tubes;
    if (isLegalMove(tubes[i], tubes[j])) {
        const newTubes = doMove(tubes, i, j, tubeDepth);
        const canonicalTubes = getCanonicalForm(newTubes);
        if (!used.has(canonicalTubes)) {
            const move = { from: i, to: j, color: tubes[i].color };
            const newState = new PuzzleState(newTubes, currentState, move);
            return [newState.g + newState.h, newState.g, newState];
        }
    }
    return undefined;
}
function unravelMoves(state) {
    let ret = [];
    if (!state.move) {
        return ret;
    }
    ret.push(state.move);
    let currentState = state;
    while (currentState.previousState) {
        currentState = currentState.previousState;
        if (currentState.move) {
            ret = [currentState.move].concat(ret);
        }
    }
    return ret;
}
function isLegalMove(i, j) {
    if (i.capacityUsed == 0) {
        return false;
    }
    if (j.color && i.color != j.color) {
        return false;
    }
    if (i.colorLength > j.capacityTotal - j.capacityUsed) {
        return false;
    }
    return true;
}
export function doMove(tubes, i, j, tubeDepth = TUBE_DEPTH) {
    const ret = tubes.slice();
    const segmentLength = ret[i].colorLength;
    const jUsed = ret[j].aryTube.slice(0, ret[j].capacityUsed).concat(Array(segmentLength).fill(ret[i].color));
    const jTube = jUsed.concat(Array(tubeDepth - jUsed.length).fill(""));
    const iUsed = ret[i].aryTube.slice(0, ret[i].capacityUsed - segmentLength);
    const iTube = iUsed.concat(Array(tubeDepth - iUsed.length).fill(""));
    ret[i] = new Tube(iTube);
    ret[j] = new Tube(jTube);
    return ret;
}
function getCanonicalForm(tubes) {
    return tubes.map((tube) => tube.toString()).sort().join("|");
}
/** Heap implementation for TypeScript. */
export class IndexMinHeap {
    constructor() {
        this.heap = [];
    }
    getParentIndex(i) { return Math.floor((i - 1) / 2); }
    getLeftChildIndex(i) { return 2 * i + 1; }
    getRightChildIndex(i) { return 2 * i + 2; }
    swap(i1, i2) {
        let temp = this.heap[i1];
        this.heap[i1] = this.heap[i2];
        this.heap[i2] = temp;
    }
    compare(item1, item2) {
        // Primary sort: Compare index 0
        if (item1[0] !== item2[0]) {
            return item1[0] - item2[0];
        }
        // Secondary sort: Compare index 1
        return item1[1] - item2[1];
    }
    insert(item) {
        this.heap.push(item);
        this.heapifyUp();
    }
    heapifyUp() {
        let index = this.heap.length - 1;
        while (index > 0) {
            const parentIdx = this.getParentIndex(index);
            if (this.compare(this.heap[index], this.heap[parentIdx]) < 0) {
                this.swap(index, parentIdx);
                index = parentIdx;
            }
            else {
                break;
            }
        }
    }
    poll() {
        if (this.heap.length === 0)
            return null;
        if (this.heap.length === 1)
            return this.heap.pop();
        const min = this.heap[0];
        const last = this.heap.pop();
        // Explicitly check to ensure we aren't putting the element back
        // if pop() emptied the array
        if (this.heap.length > 0) {
            this.heap[0] = last;
            this.heapifyDown();
        }
        return min;
    }
    heapifyDown() {
        let index = 0;
        while (this.getLeftChildIndex(index) < this.heap.length) {
            let smallerChildIndex = this.getLeftChildIndex(index);
            const rightChildIndex = this.getRightChildIndex(index);
            if (rightChildIndex < this.heap.length &&
                this.compare(this.heap[rightChildIndex], this.heap[smallerChildIndex]) < 0) {
                smallerChildIndex = rightChildIndex;
            }
            if (this.compare(this.heap[index], this.heap[smallerChildIndex]) <= 0) {
                break;
            }
            this.swap(index, smallerChildIndex);
            index = smallerChildIndex;
        }
    }
    peek() {
        return this.heap.length > 0 ? this.heap[0] : null;
    }
    size() {
        return this.heap.length;
    }
}
class Tube {
    constructor(aryTube) {
        this.aryTube = aryTube;
        this.capacityTotal = aryTube.length;
        let used = 0;
        let segments = 0;
        aryTube.forEach((pill, n) => {
            if (pill) {
                used += 1;
                if (n == 0) {
                    segments += 1;
                }
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
                if (aryTube[i] === this.color) {
                    colorLength += 1;
                }
                else {
                    break;
                }
            }
            this.colorLength = colorLength;
        }
        else {
            this.color = "";
            this.colorLength = 0;
        }
    }
    toString() {
        return this.aryTube.join("");
    }
}
class PuzzleState {
    constructor(tubes, previousBoard, move) {
        if (previousBoard) {
            this.g = previousBoard.g + 1;
        }
        else {
            this.g = 0;
        }
        this.tubes = tubes;
        this.previousState = previousBoard || null;
        this.move = move || null;
        this.h = getTubesHeuristic(tubes);
    }
}
function getTubesHeuristic(tubes) {
    const tubeSize = tubes[0].capacityTotal;
    let segments = 0;
    let filled = 0;
    tubes.forEach((tube, t) => {
        segments += tube.segments;
        filled += tube.capacityUsed;
    });
    const idealSegments = Math.floor(filled / tubeSize);
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
        ["", "", "", ""]
    ]));
}
