/**
 * The application lifecycle rules. These decide whether a worker's parked
 * applications come back or get closed, which is the part they would notice
 * most if it were wrong.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "vitest";

import { planHoldRelease } from "@/lib/applications";

const held = (id: number, status: string | null) => ({
  id,
  job_id: id,
  jobs: { id, title: `Job ${id}`, status },
});

test("a freed worker gets back every application whose job is still open", () => {
  const { restore, close } = planHoldRelease([
    held(1, "open"),
    held(2, "open"),
    held(3, "open"),
  ]);
  assert.equal(restore.length, 3);
  assert.equal(close.length, 0);
});

test("an application whose post was taken meanwhile is closed, not restored", () => {
  const { restore, close } = planHoldRelease([
    held(1, "open"),
    held(2, "filled"),
    held(3, "completed"),
  ]);
  assert.deepEqual(
    restore.map((h) => h.id),
    [1],
  );
  assert.deepEqual(
    close.map((h) => h.id),
    [2, 3],
  );
});

test("nothing is ever dropped on the floor", () => {
  const rows = [held(1, "open"), held(2, "filled"), held(3, null), held(4, "completed")];
  const { restore, close } = planHoldRelease(rows);
  assert.equal(
    restore.length + close.length,
    rows.length,
    "every held application must end up either restored or closed",
  );
  // A missing or unknown status is treated as unavailable rather than assumed open.
  assert.equal(close.some((h) => h.id === 3), true);
});

test("a job row that failed to load is closed, never silently restored", () => {
  const { restore, close } = planHoldRelease([{ jobs: null }]);
  assert.equal(restore.length, 0);
  assert.equal(close.length, 1);
});

test("no holds means no work to do", () => {
  const { restore, close } = planHoldRelease([]);
  assert.equal(restore.length, 0);
  assert.equal(close.length, 0);
});
