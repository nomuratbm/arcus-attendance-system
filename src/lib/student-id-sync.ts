import "server-only";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

const client = new LambdaClient({ maxAttempts: 2 });

/** Await queue acceptance, not execution. A failed sync must not undo registration. */
export async function syncStudentId(identity: { username: string; sub: string }, studentId: string): Promise<void> {
  const name = process.env.STUDENT_ID_SYNC_LAMBDA_NAME?.trim();
  if (!name) return;
  try {
    const result = await client.send(new InvokeCommand({
      FunctionName: name,
      InvocationType: "Event",
      Payload: new TextEncoder().encode(JSON.stringify({ username: identity.username, sub: identity.sub, student_id: studentId })),
    }), { abortSignal: AbortSignal.timeout(5000) });
    if (result.StatusCode !== 202) throw new Error("Lambda did not accept the sync event");
  } catch {
    console.error("Student profile registered, but Cognito student ID sync could not be queued. Check Lambda invocation permissions and availability.");
  }
}
