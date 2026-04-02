import {
  getCloudBaseApiBaseUrl,
  getCloudBaseEnvId,
  getCloudBaseServerApiKey,
  getCloudBaseStorageBucket,
} from "@/lib/server/cloudbase-config";

type StorageDownloadInfo = {
  downloadUrl?: string;
  expiration?: string;
  expire?: string;
  expires?: string;
  expired?: string;
  tempUrlExpire?: string;
};

export type CloudBaseStorageDownloadEntry = {
  downloadUrl: string;
  expiresAt: string | null;
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

function normalizeExpiry(info: StorageDownloadInfo): string | null {
  const value =
    info.tempUrlExpire ||
    info.expiration ||
    info.expire ||
    info.expires ||
    info.expired ||
    null;

  return value && String(value).trim() ? String(value).trim() : null;
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

export async function getCloudBaseStorageDownloadEntries(objectPaths: string[]) {
  const validPaths = Array.from(
    new Set(
      objectPaths.filter(
        (path): path is string => typeof path === "string" && path.trim().length > 0
      )
    )
  );

  if (validPaths.length === 0) {
    return new Map<string, CloudBaseStorageDownloadEntry>();
  }

  const results = await requestStorage<StorageDownloadInfo>(
    "get-objects-download-info",
    validPaths.map((objectPath) => ({
      cloudObjectId: buildCloudObjectId(objectPath),
    }))
  );

  const entries = new Map<string, CloudBaseStorageDownloadEntry>();

  results.forEach((item, index) => {
    if (!item?.downloadUrl) {
      return;
    }

    entries.set(validPaths[index], {
      downloadUrl: item.downloadUrl,
      expiresAt: normalizeExpiry(item),
    });
  });

  return entries;
}

export async function getCloudBaseStorageDownloadUrl(objectPath: string) {
  const results = await getCloudBaseStorageDownloadEntries([objectPath]);
  return results.get(objectPath)?.downloadUrl || null;
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
