const NETWORK_ERROR_PATTERN =
  /failed to fetch|fetch failed|networkerror|network request failed|load failed/i;

export function apiErrorMessage(
  data: unknown,
  fallback: string,
): string {
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string" &&
    data.error.trim()
  ) {
    return data.error.trim();
  }

  return fallback;
}

export function requestErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    return "The request timed out. Please try again.";
  }

  if (error instanceof Error) {
    if (
      error instanceof TypeError ||
      NETWORK_ERROR_PATTERN.test(error.message)
    ) {
      return "Unable to reach the server. Check your connection and try again.";
    }

    if (error.message.trim()) {
      return error.message;
    }
  }

  return fallback;
}

export async function readResponseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    if (response.ok) {
      throw new Error("The server returned an invalid response. Please try again.");
    }
    return null;
  }
}
