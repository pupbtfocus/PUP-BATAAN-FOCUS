const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailAddress(value: string) {
  const email = value.trim().toLowerCase();

  if (!EMAIL_REGEX.test(email)) {
    return false;
  }

  const domain = email.split("@")[1] ?? "";

  if (domain === "localhost" || domain.endsWith(".local")) {
    return false;
  }

  return true;
}
