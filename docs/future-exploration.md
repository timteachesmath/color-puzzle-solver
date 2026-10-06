# Future exploration

Some possibilities to explore regarding the puzzle itself, now that we have built a solver.

## Open questions

Roughly in the order worth pursuing.

1. **Does forbidding partial pours change solvability?** Partly answered,
   and the answer was yes: `solver.test.ts` now contains a board with one
   empty tube that is solvable only by splitting a two-unit block across
   two destinations. Unknown is how _often_ that happens, and whether it
   can still happen with two empty tubes available.

   A first sampled pass, 300 random boards per size, comparing exact
   breadth-first optima with and without partial pours:

   | Size                         | Solvable only with partial pours | Partial pours shorter |
   | ---------------------------- | -------------------------------- | --------------------- |
   | depth 3, n = 3–4, 1 empty    | 0 / 600                          | 0                     |
   | depth 4, n = 4, 1 empty      | 0 / 300                          | 0                     |
   | depth 4, n = 5, 1 empty      | 1 / 300 (the test board)         | 0                     |
   | depth 4, n = 4–6, 2 empty    | 0 / 900                          | 0                     |

   And on every saved daily puzzle (`n = 10`, 2 empty tubes), exact A*
   under both rules found the same optimal length every time. So far,
   partial pours decide solvability in rare one-empty-tube boards and have
   never shortened a solution. Two refinements of the question follow:
   _can a partial pour ever shorten an optimal solution?_ and _does a
   second empty tube always make them unnecessary?_ Allowing them costs
   about 1.4× in total solve time on the daily puzzles (worst board 2.9 s
   → 3.5 s).
2. **Is 2 empty tubes provably sufficient for all `n`?** The sharp form of
   the first question above. 10,400 samples is evidence; this wants an
   argument.
3. **What is the diameter?** Longest optimal solutions ran 11, 15, 18, 21
   for `n = 3…6`, and the `n = 10` daily puzzles land at 29–34. That is
   suspiciously close to `~3n`. A formula, or even a bound, would be a
   satisfying result.
4. **How tight is the heuristic?** `getTubesHeuristic` returns segments
   minus ideal segments. Measuring its gap against the true optimum across
   the same configurations is the most directly actionable item here, since
   a tighter admissible heuristic is the main remaining lever on solver
   speed.

   What is known: it is recomputed from scratch for each position, and no
   move lowers it by more than one — merging a block onto its color is
   −1, moving a block to an empty tube is 0, and a partial pour is 0 (the
   source keeps its segment and the poured units join the destination's
   top segment). That makes it consistent, so A\* stays optimal. It also
   pinpoints the slack: the 0-moves are invisible to it, which is why
   partial pours enlarge the search without ever looking like progress. A
   tighter bound would have to account for the shuffling moves a board
   forces before any merge is possible.
5. **Does inversion preserve solvability?** Not just the move count: if a
   puzzle is solvable with two empty tubes, is its inversion always
   solvable too? Cheap to test once the harness exists.


## Initial Findings

Three questions prompted a measurement run: whether two empty tubes are
always enough, how much inverting every tube changes the optimal solution,
and how much adding or removing one empty tube changes it.

`n = 3` was enumerated exhaustively — all 5,892 configurations distinct up
to tube ordering. Larger boards were sampled uniformly, since the space
grows far too fast to enumerate.

|                                   | n=3 (exhaustive) | n=4       | n=5        | n=6       |
| --------------------------------- | ---------------- | --------- | ---------- | --------- |
| Unsolvable with **2** empty tubes | **0 / 5892**     | 0 / 2000  | 0 / 2000   | 0 / 500   |
| Unsolvable with **1** empty tube  | 1422 (24%)       | 994 (50%) | 1463 (73%) | 434 (87%) |
| Longest optimal solution          | 11               | 15        | 18         | 21        |
| Max gap, 1 vs. 2 empty tubes      | +1               | +2        | +2         | +1        |
| Max gap vs. inverted puzzle       | —                | 2         | 2          | 3         |

### Two empty tubes appear to always be enough

Zero unsolvable configurations out of roughly 10,400 tested. At `n = 3`
that is a proof by exhaustion; above it, strong evidence. What remains is
a proof for general `n`, which is a different kind of work than a search.

### The second empty tube decides solvability, not length

This one's answer reframed the question. Among puzzles solvable with
either one or two empty tubes, the optimal solution differed by at most
two moves — so the second tube almost never _saves_ moves. What it does
is decide whether the puzzle can be solved at all, and that mattered for
24% of boards at `n = 3` rising to 87% at `n = 6`.

The "added" direction is settled by construction rather than by
measurement: an extra empty tube can never increase the optimal move
count, because any solution that ignores it stays valid. So the gap is
always ≥ 0.

### Inversion is the open one

Reversing every tube top-to-bottom changes the optimal solution by small
amounts that grow with `n` (2, 2, 3), and it runs in _both_ directions —
9 vs. 11 moves, 14 vs. 12, 17 vs. 20. Nothing in the data suggests a
bound. These are maxima over random samples, so a directed search over
adversarial constructions would likely find much larger gaps. This has
the most headroom of the three.

## Caveats on the above

- **Everything for `n ≥ 4` is sampled.** The zeros are evidence, not
  proof, and every maximum is a lower bound on the true maximum.
- **The numbers predate partial pours.** At measurement time `isLegalMove`
  required an entire same-color run to fit in the destination; the solver
  now pours as much as fits. Relaxing a rule can only make more boards
  solvable, so the "0 unsolvable with 2 empty tubes" result carries over
  unchanged (and was in fact measured under the _harder_ variant). The
  1-empty-tube unsolvability percentages, though, are upper bounds on what
  the current solver would report.
- **The harness was a throwaway script** and is not in this repo, so the
  table is not reproducible as-is. Rebuilding it is a prerequisite for
  the questions below. Rather than one search per starting board, the
  rebuild should enumerate every reachable position for a given size once
  and run a single breadth-first search _backward_ from the solved
  positions. That yields the exact distance-to-solved of every position —
  start boards included — in one pass, which keeps `n = 4` trivial and
  puts exhaustive `n = 5` (about 21 million boards up to tube order and
  color relabeling) within reach.

