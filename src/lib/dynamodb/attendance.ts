import {
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamodb, tableName } from "@/lib/dynamodb/client";
import {
  getStudent,
  getStudents,
  isMemberOfOrganization,
} from "@/lib/dynamodb/students";
import { formatAttendanceClockTime } from "@/lib/scan-time";
import {
  eventItemKey,
  memberItemKey,
  studentIdFromKey,
} from "@/store/dynamodb-keys";

export type CheckInResult =
  | { status: "created" }
  | { status: "already-checked-in" }
  | { status: "member-not-found" }
  | { status: "not-member" };

export type LeaveResult =
  | { status: "updated" }
  | { status: "not-checked-in" };

export type CheckInOptions = {
  membersOnly?: boolean;
  organizationId?: string;
};

export type EventCheckIn = {
  PK: string;
  SK: string;
  full_name: string;
  student_id: string;
  course: string;
  department: string;
  member_organization: string;
  scannedAt: string;
  leftAt: string;
  timestamp: number;
};

export async function checkIn(
  eventId: string,
  studentId: string,
  attendance?: {
    scannedAt: string;
    timestamp: number;
  },
  options?: CheckInOptions,
): Promise<CheckInResult> {
  const eventPK = eventItemKey(eventId);
  // The EVENT check-in child keeps the MEMBER# prefix so apex's
  // AggregateEventParticipants still recognizes it.
  const checkInSK = memberItemKey(studentId);

  const student = await getStudent(studentId);
  if (!student) {
    return { status: "member-not-found" };
  }

  // Attendance is recorded under the event's organization (passed in), not a
  // student-selected org — membership is now apex-owned.
  const memberOrganization = (options?.organizationId ?? "").trim();

  if (options?.membersOnly && memberOrganization) {
    if (!(await isMemberOfOrganization(studentId, memberOrganization))) {
      return { status: "not-member" };
    }
  }

  const now = new Date();
  const scannedAt = attendance?.scannedAt ?? formatAttendanceClockTime(now);
  const timestamp = attendance?.timestamp ?? now.getTime();

  try {
    await dynamodb.send(
      new PutCommand({
        TableName: tableName(),
        Item: {
          PK: eventPK,
          SK: checkInSK,
          member_organization: memberOrganization,
          scannedAt,
          timestamp,
        },
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );

    return { status: "created" };
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) {
      return { status: "already-checked-in" };
    }

    throw error;
  }
}

export async function recordLeave(
  eventId: string,
  studentId: string,
  leftAt?: string,
): Promise<LeaveResult> {
  const eventPK = eventItemKey(eventId);
  const checkInSK = memberItemKey(studentId);
  const leftAtValue = leftAt ?? formatAttendanceClockTime();

  try {
    await dynamodb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: {
          PK: eventPK,
          SK: checkInSK,
        },
        UpdateExpression: "SET leftAt = :leftAt",
        ExpressionAttributeValues: {
          ":leftAt": leftAtValue,
        },
        ConditionExpression: "attribute_exists(PK)",
      }),
    );

    return { status: "updated" };
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) {
      return { status: "not-checked-in" };
    }

    throw error;
  }
}

export async function listEventCheckIns(
  eventId: string,
): Promise<EventCheckIn[]> {
  const eventPK = eventItemKey(eventId);
  const checkIns = await queryEventCheckIns(eventPK);
  const students = await getStudents(
    checkIns.map((checkIn) => String(checkIn.SK ?? "")),
  );

  return checkIns.map((checkIn) => {
    const sk = String(checkIn.SK ?? "");
    const studentId = studentIdFromKey(sk);
    const student = students.get(studentId) ?? null;
    const timestamp =
      typeof checkIn.timestamp === "number"
        ? checkIn.timestamp
        : Number(checkIn.timestamp);

    return {
      PK: typeof checkIn.PK === "string" && checkIn.PK ? checkIn.PK : eventPK,
      SK: sk,
      full_name: student?.full_name ?? "",
      student_id: student?.student_id || studentId,
      course: student?.course ?? "",
      department: student?.department ?? "",
      member_organization:
        typeof checkIn.member_organization === "string"
          ? checkIn.member_organization
          : "",
      scannedAt: clockValue(checkIn.scannedAt),
      leftAt: clockValue(checkIn.leftAt),
      timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    };
  });
}

function clockValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return formatAttendanceClockTime(new Date(value));
  }

  return "";
}

async function queryEventCheckIns(
  eventPK: string,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await dynamodb.send(
      new QueryCommand({
        ...(exclusiveStartKey
          ? { ExclusiveStartKey: exclusiveStartKey }
          : {}),
        ExpressionAttributeValues: {
          ":member": "MEMBER#",
          ":pk": eventPK,
        },
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :member)",
        TableName: tableName(),
      }),
    );

    if (result.Items) {
      items.push(...(result.Items as Record<string, unknown>[]));
    }

    exclusiveStartKey = result.LastEvaluatedKey as
      | Record<string, unknown>
      | undefined;
  } while (exclusiveStartKey);

  return items;
}

function isConditionalCheckFailed(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: string }).name === "ConditionalCheckFailedException"
  );
}
