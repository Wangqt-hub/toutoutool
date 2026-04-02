const CHINA_MOBILE_PREFIX = "+86";

export function normalizePhoneNumber(rawValue: string): string | null {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("+")) {
    const normalized = trimmed.replace(/\s+/g, "");
    return /^\+\d{8,20}$/.test(normalized) ? normalized : null;
  }

  const digitsOnly = trimmed.replace(/\D+/g, "");

  if (/^1\d{10}$/.test(digitsOnly)) {
    return `${CHINA_MOBILE_PREFIX}${digitsOnly}`;
  }

  return null;
}

export function formatPhoneForDisplay(phoneNumber: string): string {
  return phoneNumber.replace(/\s+/g, "");
}
