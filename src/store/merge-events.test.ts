import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeEventsByPk,
  mergeEventsForOrganization,
  mergePersistedEventSelection,
  readPersistedSelectedEventPK,
  resolveSelectedEventPK,
} from "./merge-events.ts";

const localEvent = { PK: "EVENT#new" };
const existingEvent = { PK: "EVENT#old" };
const updatedExisting = { PK: "EVENT#old", name: "from-server" };

test("org merge keeps only local events for the selected organization", () => {
  const orgA = "ORGANIZATION#org-a";
  const orgB = "ORGANIZATION#org-b";
  const localA = { PK: "EVENT#local-a", GSI3SK: orgA };
  const localB = { PK: "EVENT#local-b", GSI3SK: orgB };
  const incomingA = { PK: "EVENT#server-a", GSI3SK: orgA };

  const merged = mergeEventsForOrganization(
    [localA, localB],
    [incomingA],
    orgA,
  );

  assert.deepEqual(merged, [localA, incomingA]);
});

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

test("persist merge prefers stored organization over the default", () => {
  const current = {
    selectedEventPK: null,
    selectedOrganizationId: "default-org",
  };

  assert.equal(
    mergePersistedEventSelection(
      { selectedOrganizationId: "stored-org" },
      current,
    ).selectedOrganizationId,
    "stored-org",
  );
});
