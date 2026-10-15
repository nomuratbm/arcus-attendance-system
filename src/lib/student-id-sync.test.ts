import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { syncStudentId } from "./student-id-sync.ts";

function configure(t: TestContext, name?: string) {
  const previous = process.env.STUDENT_ID_SYNC_LAMBDA_NAME;
  if (name === undefined) delete process.env.STUDENT_ID_SYNC_LAMBDA_NAME;
  else process.env.STUDENT_ID_SYNC_LAMBDA_NAME = name;
  t.after(() => {
    if (previous === undefined) delete process.env.STUDENT_ID_SYNC_LAMBDA_NAME;
    else process.env.STUDENT_ID_SYNC_LAMBDA_NAME = previous;
  });
}

const identity = { username: "verified-user", sub: "verified-sub" };

test("unconfigured student ID sync makes no AWS call", async (t) => {
  configure(t);
  const send = t.mock.method(LambdaClient.prototype, "send", async () => {
    throw new Error("Unexpected AWS call");
  });
  await syncStudentId(identity, "2026123456");
  assert.equal(send.mock.callCount(), 0);
});

test("student ID sync queues the verified identity with asynchronous invocation", async (t) => {
  configure(t, " student-id-sync ");
  let input: InvokeCommand["input"] | undefined;
  t.mock.method(LambdaClient.prototype, "send", async (command: InvokeCommand) => {
    input = command.input;
    return { StatusCode: 202 };
  });
  await syncStudentId(identity, "2026123456");
  assert.ok(input);
  assert.equal(input.FunctionName, "student-id-sync");
  assert.equal(input.InvocationType, "Event");
  assert.ok(input.Payload instanceof Uint8Array);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(input.Payload)), {
    username: identity.username, sub: identity.sub, student_id: "2026123456",
  });
});

for (const failure of ["exception", "rejected"] as const) {
  test(`student ID sync ${failure} does not fail registration or log identity`, async (t) => {
    configure(t, "student-id-sync");
    t.mock.method(LambdaClient.prototype, "send", async () => {
      if (failure === "exception") throw new Error("2026123456 verified-user private-details");
      return { StatusCode: 500 };
    });
    const log = t.mock.method(console, "error", () => {});
    await assert.doesNotReject(syncStudentId(identity, "2026123456"));
    assert.equal(log.mock.callCount(), 1);
    assert.doesNotMatch(String(log.mock.calls[0].arguments[0]), /2026123456|verified-user|private-details/);
  });
}
