export function validateRequired(value: any, fieldName: string): void {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${fieldName} is required`);
  }
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/** Validate required human text without rewriting punctuation or whitespace. */
export function requireText(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be non-empty text`);
  }
  return value;
}

export function validateApiKey(apiKey: string, minLength = 10): boolean {
  return typeof apiKey === "string" && apiKey.length >= minLength;
}
