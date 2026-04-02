export const SESSION_COOKIE_NAME = "tt_session";
export const SESSION_HINT_COOKIE_NAME = "tt_auth_hint";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type AppSession = {
  userId: string;
  phoneNumber: string | null;
  createdAt: string;
  expiresAt: string;
};

const encoder = new TextEncoder();

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim();

  if (!secret) {
    throw new Error("SESSION_SECRET is not configured.");
  }

  return secret;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let base64 = "";

  if (typeof Buffer !== "undefined") {
    base64 = Buffer.from(bytes).toString("base64");
  } else {
    let binary = "";

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    base64 = btoa(binary);
  }

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(padded, "base64"));
  }

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function getSigningKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSessionSecret()),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign", "verify"]
  );
}

export function buildSession(options: {
  userId: string;
  phoneNumber: string | null;
}): AppSession {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);

  return {
    userId: options.userId,
    phoneNumber: options.phoneNumber,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function createSessionToken(session: AppSession): Promise<string> {
  const payload = encodeBase64Url(encoder.encode(JSON.stringify(session)));
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));

  return `${payload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(
  token: string | null | undefined
): Promise<AppSession | null> {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const key = await getSigningKey();
  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    toArrayBuffer(decodeBase64Url(signature)),
    encoder.encode(payload)
  );

  if (!isValid) {
    return null;
  }

  try {
    const session = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(payload))
    ) as AppSession;

    if (!session.userId || !session.createdAt || !session.expiresAt) {
      return null;
    }

    if (Date.parse(session.expiresAt) <= Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}



