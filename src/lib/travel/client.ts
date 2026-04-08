type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

function extractHtmlTitle(html: string) {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
  return match?.[1]?.trim() || "";
}

export async function readTravelApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error(
      response.ok
        ? "Server returned an empty response."
        : `Request failed with status ${response.status}.`
    );
  }

  const looksLikeJson =
    contentType.includes("application/json") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[");

  if (!looksLikeJson) {
    if (trimmed.startsWith("<")) {
      const title = extractHtmlTitle(trimmed);
      throw new Error(
        title
          ? `Server returned an HTML page instead of JSON: ${title}.`
          : "Server returned an HTML page instead of JSON."
      );
    }

    throw new Error(
      response.ok
        ? "Server returned a non-JSON response."
        : `Request failed with status ${response.status}.`
    );
  }

  let payload: ApiEnvelope<T>;

  try {
    payload = JSON.parse(trimmed) as ApiEnvelope<T>;
  } catch {
    throw new Error("Server returned malformed JSON.");
  }

  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload.data;
}
