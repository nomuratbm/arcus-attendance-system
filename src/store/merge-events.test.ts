import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeEventsByPk,
  mergePersistedEventSelection,
  readPersistedSelectedEventPK,
  resolveSelectedEventPK,
} from "./merge-events.ts";

const localEvent = { PK: "EVENT#new" };
const existingEvent = { PK: "EVENT#old" };
const updatedExisting = { PK: "EVENT#old", name: "from-server" };

test("empty GET keeps locally added events", () => {
  const merged = mergeEventsByPk([localEvent], []);
  assert.deepEqual(merged, [localEvent]);
  assert.equal(resolveSelectedEventPK("EVENT#new", merged), "EVENT#new");
});

test("stale GET keeps local-only PK and lets server win on overlap", () => {
  const merged = mergeEventsByPk(
    [localEvent, existingEvent],
    [updatedExisting],
  );
  assert.deepEqual(merged, [localEvent, updatedExisting]);
  assert.equal(resolveSelectedEventPK("EVENT#new", merged), "EVENT#new");
});

test("complete GET replaces matching PKs and drops selection if missing", () => {
  const merged = mergeEventsByPk([localEvent], [localEvent, existingEvent]);
  assert.deepEqual(merged, [localEvent, existingEvent]);
  assert.equal(resolveSelectedEventPK("EVENT#gone", merged), null);
});

test("persist merge does not wipe fetched events", () => {
  const current = {
    events: [localEvent],
    selectedEventPK: "EVENT#new",
    eventsLoading: false,
    eventsError: null,
  };

  assert.deepEqual(mergePersistedEventSelection(undefined, current).events, [
    localEvent,
  ]);
  assert.deepEqual(
    mergePersistedEventSelection({ events: [], selectedEventPK: null }, current)
      .events,
    [localEvent],
  );
  assert.equal(
    mergePersistedEventSelection(
      { selectedEventPK: "EVENT#old" },
      { ...current, selectedEventPK: null },
    ).selectedEventPK,
    "EVENT#old",
  );
});

test("persisted events arrays are ignored", () => {
  assert.equal(
    readPersistedSelectedEventPK({
      events: [{ PK: "EVENT#stale" }],
      selectedEventPK: "EVENT#keep",
    }),
    "EVENT#keep",
  );
});
