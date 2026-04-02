import {
  getCloudBaseApiBaseUrl,
  getCloudBaseEnvId,
  getCloudBaseServerApiKey,
} from "@/lib/server/cloudbase-config";

function buildRdbUrl(
  table: string,
  query?: Record<string, string | number | null | undefined>
) {
  const instance = process.env.CLOUDBASE_SQL_INSTANCE?.trim() || "default";
  const schema = process.env.CLOUDBASE_SQL_SCHEMA?.trim() || getCloudBaseEnvId();
  const url = new URL(
    `${getCloudBaseApiBaseUrl()}/rdb/rest/${instance}/${schema}/${table}`
  );

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
}

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

export function eq(value: string) {
  return `eq.${value}`;
}

export async function queryCloudBaseRdb<T>(
  table: string,
  query?: Record<string, string | number | null | undefined>
): Promise<T[]> {
  const response = await fetch(buildRdbUrl(table, query), {
    headers: {
      Authorization: `Bearer ${getCloudBaseServerApiKey()}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await readJson(response)) as
      | { message?: string; error?: string }
      | null;
    throw new Error(
      payload?.message ||
        payload?.error ||
        `CloudBase RDB request failed with ${response.status}`
    );
  }

  const payload = await readJson(response);
  return Array.isArray(payload) ? (payload as T[]) : [];
}

export async function getCloudBaseRdbFirstRow<T>(
  table: string,
  query?: Record<string, string | number | null | undefined>
): Promise<T | null> {
  const rows = await queryCloudBaseRdb<T>(table, {
    ...(query || {}),
    limit: 1,
  });

  return rows[0] || null;
}
