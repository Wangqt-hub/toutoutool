import { randomUUID } from "node:crypto";
import { getCloudBaseAuthBaseUrl, getCloudBaseClientId } from "@/lib/server/cloudbase-config";

type RpcError = {
  error?: string;
  error_description?: string;
  message?: string;
};

type VerifyCodeResponse = {
  verification_token: string;
  expires_in: number;
};

type AuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  sub: string;
  expires_in: number;
};

type SendCodeResponse = {
  verification_id: string;
  expires_in: number;
  is_user?: boolean;
};

type CloudBaseProfile = {
  sub: string;
  phone_number?: string;
};

export class CloudBaseAuthError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "CloudBaseAuthError";
    this.status = status;
    this.code = code;
  }
}

function getDeviceId(deviceId?: string) {
  return deviceId?.trim() || `tt-${randomUUID()}`;
}

async function parseError(response: Response) {
  let payload: RpcError | null = null;

  try {
    payload = (await response.json()) as RpcError;
  } catch {
    payload = null;
  }

  return new CloudBaseAuthError(
    payload?.error_description || payload?.message || "CloudBase auth request failed.",
    response.status,
    payload?.error
  );
}

async function requestAuth<T>(
  path: string,
  options: {
    method: "GET" | "POST";
    deviceId?: string;
    body?: Record<string, unknown>;
    accessToken?: string;
  }
): Promise<T> {
  const url = new URL(`${getCloudBaseAuthBaseUrl()}${path}`);
  url.searchParams.set("client_id", getCloudBaseClientId());

  const response = await fetch(url.toString(), {
    method: options.method,
    headers: {
      "Content-Type": "application/json",
      "x-device-id": getDeviceId(options.deviceId),
      ...(options.accessToken
        ? { Authorization: `Bearer ${options.accessToken}` }
        : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return (await response.json()) as T;
}

export function sendPhoneVerificationCode(options: {
  phoneNumber: string;
  deviceId?: string;
  target: "ANY" | "USER";
}) {
  return requestAuth<SendCodeResponse>("/verification", {
    method: "POST",
    deviceId: options.deviceId,
    body: {
      phone_number: options.phoneNumber,
      target: options.target,
    },
  });
}

export function verifyPhoneCode(options: {
  verificationId: string;
  verificationCode: string;
  deviceId?: string;
}) {
  return requestAuth<VerifyCodeResponse>("/verification/verify", {
    method: "POST",
    deviceId: options.deviceId,
    body: {
      verification_id: options.verificationId,
      verification_code: options.verificationCode,
    },
  });
}

export function signInWithVerificationToken(options: {
  verificationToken: string;
  deviceId?: string;
}) {
  return requestAuth<AuthTokenResponse>("/signin", {
    method: "POST",
    deviceId: options.deviceId,
    body: {
      verification_token: options.verificationToken,
    },
  });
}

export function signUpWithVerificationToken(options: {
  verificationToken: string;
  phoneNumber: string;
  deviceId?: string;
}) {
  return requestAuth<AuthTokenResponse>("/signup", {
    method: "POST",
    deviceId: options.deviceId,
    body: {
      phone_number: options.phoneNumber,
      verification_token: options.verificationToken,
    },
  });
}

export function getCloudBaseProfile(options: {
  accessToken: string;
  deviceId?: string;
}) {
  return requestAuth<CloudBaseProfile>("/user/me", {
    method: "GET",
    deviceId: options.deviceId,
    accessToken: options.accessToken,
  });
}
