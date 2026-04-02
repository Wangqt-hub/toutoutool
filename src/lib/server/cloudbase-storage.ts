import {
  getCloudBaseApiBaseUrl,
  getCloudBaseEnvId,
  getCloudBaseServerApiKey,
  getCloudBaseStorageBucket,
} from "@/lib/server/cloudbase-config";

type StorageDownloadInfo = {
  downloadUrl?: string;
};

async function readJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function buildCloudObjectId(objectPath: string) {
  return `cloud://${getCloudBaseEnvId()}.${getCloudBaseStorageBucket()}/${objectPath}`;
}

async function requestStorage<T>(path: string, body: unknown): Promise<T[]> {
  const response = await fetch(`${getCloudBaseApiBaseUrl()}/storages/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getCloudBaseServerApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await readJson(response)) as
      | { message?: string; error?: string }
      | null;
    throw new Error(
      payload?.message ||
        payload?.error ||
        `CloudBase storage request failed with ${response.status}`
    );
  }

  const payload = await readJson(response);
  return Array.isArray(payload) ? (payload as T[]) : [];
}

export async function getCloudBaseStorageDownloadUrl(objectPath: string) {
  const results = await requestStorage<StorageDownloadInfo>(
    "get-objects-download-info",
    [{ cloudObjectId: buildCloudObjectId(objectPath) }]
  );

  return results[0]?.downloadUrl || null;
}

export async function downloadCloudBaseObject(objectPath: string) {
  const downloadUrl = await getCloudBaseStorageDownloadUrl(objectPath);

  if (!downloadUrl) {
    throw new Error("Download URL is not available.");
  }

  const response = await fetch(downloadUrl, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to download object: ${response.status}`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType:
      response.headers.get("content-type") || "application/octet-stream",
  };
}
