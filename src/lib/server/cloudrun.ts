import {
  getCloudBaseAIServiceName,
  getCloudBaseApiBaseUrl,
  getCloudBaseServerApiKey,
  getInternalApiSecret,
} from "@/lib/server/cloudbase-config";

type CloudRunErrorPayload<T = unknown> = {
  code?: string;
  message?: string;
  error?: string;
  data?: T;
};

export class CloudRunServiceError<T = unknown> extends Error {
  status: number;
  code?: string;
  data?: T;

  constructor(options: {
    message: string;
    status: number;
    code?: string;
    data?: T;
  }) {
    super(options.message);
    this.name = "CloudRunServiceError";
    this.status = options.status;
    this.code = options.code;
    this.data = options.data;
  }
}

function buildCloudRunUrl(path: string) {
  const serviceName = getCloudBaseAIServiceName();
  const normalizedPath = path.replace(/^\/+/, "");

  if (!normalizedPath) {
    return `${getCloudBaseApiBaseUrl()}/cloudrun/${serviceName}`;
  }

  return `${getCloudBaseApiBaseUrl()}/cloudrun/${serviceName}/${normalizedPath}`;
}

export async function callAIService<T>(
  path: string,
  options: {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    expectedResponseType?: "json" | "arrayBuffer" | "text";
    headers?: Record<string, string>;
  }
): Promise<T> {
  const response = await fetch(buildCloudRunUrl(path), {
    method: options.method,
    headers: {
      Authorization: `Bearer ${getCloudBaseServerApiKey()}`,
      "Content-Type": "application/json",
      "x-internal-api-secret": getInternalApiSecret(),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  if (!response.ok) {
    let payload: CloudRunErrorPayload | null = null;

    try {
      payload = (await response.json()) as CloudRunErrorPayload;
    } catch {
      payload = null;
    }

    throw new CloudRunServiceError({
      message: payload?.error || payload?.message || "AI service request failed.",
      status: response.status,
      code: payload?.code,
      data: payload?.data,
    });
  }

  if (options.expectedResponseType === "arrayBuffer") {
    return (await response.arrayBuffer()) as T;
  }

  if (options.expectedResponseType === "text") {
    return (await response.text()) as T;
  }

  return (await response.json()) as T;
}
