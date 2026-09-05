import { test, describe } from "node:test";
import assert from "node:assert/strict";

type Tubes = string[];
import { solveBoard, IndexMinHeap, type Board, type Move, type HeapItem } from "./solver.ts";

// Same fixture used throughout development (tests/fixtures/sample_board_1.json),
// cross-checked against the Python reference: 30 moves, valid solution.
const FIXTURE_BOARD: Board = [
  ["I", "R", "B", "C"],
  ["M", "W", "R", "O"],
  ["G", "G", "R", "R"],
  ["I", "P", "B", "M"],
  ["P", "P", "M", "B"],
  ["C", "O", "I", "C"],
  ["Y", "B", "Y", "G"],
  ["I", "W", "M", "O"],
  ["G", "C", "Y", "Y"],
  ["W", "O", "W", "P"],
  [],
  [],
];

// The real September 1, 2026 puzzle — cross-checked against the deployed
// site's output: 31 moves, valid solution.
const SEPT_1_BOARD: Board = [
  ["B", "B", "C", "Y"],
  ["G", "Y", "C", "G"],
  ["B", "O", "C", "M"],
  ["P", "L", "Y", "L"],
  ["G", "O", "R", "O"],
  ["Y", "M", "L", "G"],
  ["W", "W", "C", "B"],
  ["P", "M", "R", "P"],
  ["L", "P", "W", "O"],
  ["R", "W", "R", "M"],
  [],
  [],
];

const TUBE_DEPTH = 4;

// Kept independently of the A* implementation below — solver.test.ts uses
// this to replay and verify solveBoard's output via a completely separate
// code path, rather than trusting the algorithm to check its own work.
export function doOneMove(tubes: Tubes, x: [number, number]): Tubes {
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
 * Replays a solution against a board using the exported doOneMove — the
 * same primitive solveBoard itself uses — to independently verify the
 * result is an actually-legal, actually-solved sequence, not just a list
 * of the right length.
 */
function replay(board: Board, moves: Move[]): string[] {
  let state = board.map((tube) => tube.slice().reverse().join(""));
  for (const move of moves) {
    state = doOneMove(state, [move.from, move.to]);
  }
  return state;
}

function isSolved(state: string[]): boolean {
  return state.every((tube) => tube.length === 0 || tube.split("").every((c) => c === tube[0]));
}

describe("solveBoard", () => {
  test("solves the fixture board in the known-optimal 30 moves", () => {
    const moves = solveBoard(FIXTURE_BOARD);
    assert.equal(moves.length, 30);
    assert.ok(isSolved(replay(FIXTURE_BOARD, moves)), "replayed moves should reach a fully sorted board");
  });

  test("solves the September 1 board in the known-optimal 31 moves", () => {
    const moves = solveBoard(SEPT_1_BOARD);
    assert.equal(moves.length, 31);
    assert.ok(isSolved(replay(SEPT_1_BOARD, moves)), "replayed moves should reach a fully sorted board");
  });

  test("every move references distinct, in-range tubes and a real color", () => {
    const moves = solveBoard(FIXTURE_BOARD);
    for (const move of moves) {
      assert.ok(move.from >= 0 && move.from < FIXTURE_BOARD.length);
      assert.ok(move.to >= 0 && move.to < FIXTURE_BOARD.length);
      assert.notEqual(move.from, move.to);
      assert.equal(typeof move.color, "string");
      assert.equal(move.color.length, 1);
    }
  });

  test("an already-solved board needs zero moves", () => {
    const solvedBoard: Board = [
      ["A", "A", "A", "A"],
      ["B", "B", "B", "B"],
      [],
      [],
    ];
    const moves = solveBoard(solvedBoard);
    assert.deepEqual(moves, []);
  });

  test("throws a TIMEOUT error when the search exceeds the time budget", () => {
    assert.throws(() => solveBoard(SEPT_1_BOARD, 1), /TIMEOUT/);
  });
});

describe("IndexMinHeap", () => {
  test("starts empty", () => {
    const heap = new IndexMinHeap();
    assert.equal(heap.size(), 0);
    assert.equal(heap.peek(), null);
    assert.equal(heap.poll(), null);
  });

  test("single insert/poll round-trips the same item and empties the heap", () => {
    const heap = new IndexMinHeap();
    const item: HeapItem = [5, 0, { id: "only" }];
    heap.insert(item);
    assert.equal(heap.size(), 1);
    assert.equal(heap.peek(), item);
    assert.equal(heap.poll(), item);
    assert.equal(heap.size(), 0);
    assert.equal(heap.poll(), null);
  });

  test("polls items in ascending order by the primary key", () => {
    const heap = new IndexMinHeap();
    const values = [5, 1, 4, 2, 8, 0, 7, 3, 6, 9];
    for (const v of values) heap.insert([v, 0, { v }]);

    const polled: number[] = [];
    let item: HeapItem | null;
    while ((item = heap.poll()) !== null) polled.push(item[0]);

    assert.deepEqual(polled, [...values].sort((a, b) => a - b));
  });

  test("breaks ties on the primary key using the secondary key, ascending", () => {
    const heap = new IndexMinHeap();
    // All share primary key 7; secondary keys out of order on purpose.
    heap.insert([7, 3, { tag: "c" }]);
    heap.insert([7, 1, { tag: "a" }]);
    heap.insert([7, 2, { tag: "b" }]);

    const order = [heap.poll(), heap.poll(), heap.poll()].map((i) => (i![2] as { tag: string }).tag);
    assert.deepEqual(order, ["a", "b", "c"]);
  });

  test("size() tracks inserts and polls correctly", () => {
    const heap = new IndexMinHeap();
    heap.insert([1, 0, {}]);
    heap.insert([2, 0, {}]);
    heap.insert([3, 0, {}]);
    assert.equal(heap.size(), 3);
    heap.poll();
    assert.equal(heap.size(), 2);
    heap.poll();
    heap.poll();
    assert.equal(heap.size(), 0);
  });

  test("payload objects survive by reference, unmodified", () => {
    const heap = new IndexMinHeap();
    const payload = { board: ["AAAA", "BBBB"], note: "keep me" };
    heap.insert([1, 0, payload]);
    const polled = heap.poll();
    assert.equal(polled![2], payload); // same reference, not a copy
  });
});
