type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function readTravelApiResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload.data;
}
