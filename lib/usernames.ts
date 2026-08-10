export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._-]*[A-Za-z0-9]$/;

export function normalizeUsername(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function getUsernameFormatError(value: string) {
  const normalized = normalizeUsername(value);

  if (
    normalized.length < USERNAME_MIN_LENGTH ||
    normalized.length > USERNAME_MAX_LENGTH
  ) {
    return `Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters.`;
  }

  if (!USERNAME_PATTERN.test(normalized)) {
    return "Use letters, numbers, spaces, periods, underscores, or hyphens, and start and end with a letter or number.";
  }

  return null;
}
