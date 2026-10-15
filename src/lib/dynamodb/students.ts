import {
  BatchGetCommand,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamodb, tableName } from "@/lib/dynamodb/client";
import {
  memberItemKey,
  organizationItemKey,
  studentIdFromKey,
  studentItemKey,
} from "@/store/dynamodb-keys";
import { type Student } from "@/store/student-item";

export type { Student };

export type StudentDetails = Omit<Student, "PK" | "SK">;

export type RegisterStudentResult =
  | { status: "created" }
  | { status: "exists" };

/**
 * Write ONLY the STUDENT profile item (PK=SK=STUDENT#{studentId}).
 *
 * Organization membership is no longer written here — apex owns the
 * ORGANIZATION#{org}/MEMBER#{studentId} roster.
 */
export async function registerStudent(
  details: StudentDetails,
): Promise<RegisterStudentResult> {
  const studentId = details.student_id.trim();
  const key = studentItemKey(studentId);

  try {
    await dynamodb.send(
      new PutCommand({
        TableName: tableName(),
        Item: {
          PK: key,
          SK: key,
          ...details,
          student_id: studentId,
        },
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );

    return { status: "created" };
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) {
      return { status: "exists" };
    }

    throw error;
  }
}

export async function getStudent(studentId: string): Promise<Student | null> {
  const trimmed = studentId.trim();
  if (!trimmed) {
    return null;
  }

  return getStudentByKey(studentItemKey(trimmed));
}

/**
 * Batch-fetch STUDENT profiles. Accepts raw student numbers or any
 * STUDENT#/MEMBER# key and returns a map keyed by the raw student number so
 * attendance rows (whose SK is MEMBER#{studentId}) can resolve names.
 */
export async function getStudents(
  studentIds: string[],
): Promise<Map<string, Student>> {
  const students = new Map<string, Student>();
  const uniqueIds = Array.from(
    new Set(
      studentIds
        .map((value) => studentIdFromKey(value))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

  if (uniqueIds.length === 0) {
    return students;
  }

  const name = tableName();

  for (let offset = 0; offset < uniqueIds.length; offset += 100) {
    let keysToFetch = uniqueIds.slice(offset, offset + 100).map((id) => {
      const key = studentItemKey(id);
      return { PK: key, SK: key };
    });

    while (keysToFetch.length > 0) {
      const result = await dynamodb.send(
        new BatchGetCommand({
          RequestItems: {
            [name]: {
              Keys: keysToFetch,
            },
          },
        }),
      );

      for (const item of result.Responses?.[name] ?? []) {
        const student = studentFromRecord(item as Record<string, unknown>);
        if (student) {
          students.set(student.student_id, student);
        }
      }

      keysToFetch = (result.UnprocessedKeys?.[name]?.Keys ?? []) as {
        PK: string;
        SK: string;
      }[];
    }
  }

  return students;
}

/**
 * Membership check against the apex-owned organization roster
 * (PK=ORGANIZATION#{org}, SK=MEMBER#{studentId}). Used by the scanner's
 * "Allow members only" toggle.
 */
export async function isMemberOfOrganization(
  studentId: string,
  organizationId: string,
): Promise<boolean> {
  const result = await dynamodb.send(
    new GetCommand({
      TableName: tableName(),
      Key: {
        PK: organizationItemKey(organizationId),
        SK: memberItemKey(studentId),
      },
      ProjectionExpression: "PK, SK",
    }),
  );
  return Boolean(result.Item);
}

async function getStudentByKey(key: string): Promise<Student | null> {
  const result = await dynamodb.send(
    new GetCommand({
      TableName: tableName(),
      Key: {
        PK: key,
        SK: key,
      },
    }),
  );

  return result.Item
    ? studentFromRecord(result.Item as Record<string, unknown>)
    : null;
}

function studentFromRecord(item: Record<string, unknown>): Student | null {
  const pk = typeof item.PK === "string" ? item.PK : "";
  const sk = typeof item.SK === "string" && item.SK ? item.SK : pk;
  if (!pk) {
    return null;
  }

  const studentId =
    typeof item.student_id === "string" && item.student_id
      ? item.student_id
      : studentIdFromKey(pk);

  return {
    PK: pk,
    SK: sk,
    full_name: typeof item.full_name === "string" ? item.full_name : "",
    student_id: studentId,
    course: typeof item.course === "string" ? item.course : "",
    department: typeof item.department === "string" ? item.department : "",
  };
}

function isConditionalCheckFailed(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: string }).name === "ConditionalCheckFailedException"
  );
}
