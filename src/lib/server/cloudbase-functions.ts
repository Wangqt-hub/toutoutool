import {
  getCloudBaseApiBaseUrl,
  getCloudBaseServerApiKey,
} from "@/lib/server/cloudbase-config";

type FunctionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  status?: number;
};

export class CloudBaseFunctionError<T = unknown> extends Error {
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
    this.name = "CloudBaseFunctionError";
    this.status = options.status;
    this.code = options.code;
    this.data = options.data;
  }
}

async function parseFunctionPayload<T>(response: Response) {
  const text = await response.text();

  if (!text) {
    throw new CloudBaseFunctionError({
      message: "CloudBase function returned an empty response.",
      status: response.status,
    });
  }

  try {
    return JSON.parse(text) as FunctionResponse<T>;
  } catch {
    throw new CloudBaseFunctionError({
      message: text,
      status: response.status,
    });
  }
}

export async function callCloudBaseFunction<T>(
  functionName: string,
  payload: Record<string, unknown>
): Promise<T> {
  const response = await fetch(
    `${getCloudBaseApiBaseUrl()}/functions/${functionName}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getCloudBaseServerApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    }
  );

  const parsed = await parseFunctionPayload<T>(response);

  if (!response.ok || !parsed.success || parsed.data === undefined) {
    throw new CloudBaseFunctionError({
      message: parsed.error || "CloudBase function request failed.",
      status: parsed.status || response.status,
      code: parsed.code,
      data: parsed.data,
    });
  }

  return parsed.data;
}
