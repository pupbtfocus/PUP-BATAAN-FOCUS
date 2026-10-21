export interface PasswordRequirement {
  id: string;
  label: string;
  shortLabel: string;
  isValid: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  hasNoSpaces: boolean;
  missingRequirements: string[];
  requirements: PasswordRequirement[];
}

/**
 * Validates a password against common campus security policy requirements.
 */
export function validatePasswordRequirements(password: string): PasswordValidationResult {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password);
  const hasNoSpaces = !/\s/.test(password);

  const requirements: PasswordRequirement[] = [
    { id: "length", label: "At least 8 characters", shortLabel: "8+ characters", isValid: hasMinLength },
    { id: "uppercase", label: "One uppercase letter (A–Z)", shortLabel: "Uppercase (A–Z)", isValid: hasUppercase },
    { id: "lowercase", label: "One lowercase letter (a–z)", shortLabel: "Lowercase (a–z)", isValid: hasLowercase },
    { id: "number", label: "One number (0–9)", shortLabel: "Number (0–9)", isValid: hasNumber },
    { id: "special", label: "One special character (!@#$%...)", shortLabel: "Symbol (!@#$%...)", isValid: hasSpecialChar },
    { id: "noSpaces", label: "No spaces allowed", shortLabel: "No spaces", isValid: hasNoSpaces },
  ];

  const missingRequirements = requirements
    .filter((req) => !req.isValid)
    .map((req) => req.label);

  return {
    isValid: missingRequirements.length === 0,
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar,
    hasNoSpaces,
    missingRequirements,
    requirements,
  };
}

/**
 * Formats raw Supabase or server password policy errors into clean, organized text.
 */
export function formatPasswordError(rawMessage?: string | null): string {
  if (!rawMessage) return "";

  const trimmed = rawMessage.trim();

  // Detect Supabase raw password policy message (e.g. "Password should contain at least one character of each: ...")
  if (
    trimmed.includes("abcdefghijklmnopqrstuvwxyz") ||
    trimmed.toLowerCase().includes("password should contain at least one character of each") ||
    trimmed.toLowerCase().includes("password must contain")
  ) {
    const missing: string[] = [];

    if (trimmed.includes("ABCDEFGHIJKLMNOPQRSTUVWXYZ") || trimmed.includes("[A-Z]")) {
      missing.push("• One uppercase letter (A–Z)");
    }
    if (trimmed.includes("abcdefghijklmnopqrstuvwxyz") || trimmed.includes("[a-z]")) {
      missing.push("• One lowercase letter (a–z)");
    }
    if (trimmed.includes("0123456789") || trimmed.includes("[0-9]")) {
      missing.push("• One number (0–9)");
    }
    if (
      trimmed.includes("!@#$%") ||
      trimmed.includes("`~") ||
      trimmed.toLowerCase().includes("symbol") ||
      trimmed.toLowerCase().includes("special")
    ) {
      missing.push("• One special character (!@#$%...)");
    }
    if (trimmed.toLowerCase().includes("space") || trimmed.toLowerCase().includes("whitespace")) {
      missing.push("• No spaces allowed");
    }

    if (missing.length > 0) {
      return `Password must include:\n${missing.join("\n")}`;
    }

    return "Password must include:\n• At least 8 characters\n• One uppercase letter (A–Z)\n• One lowercase letter (a–z)\n• One number (0–9)\n• One special character (!@#$%...)\n• No spaces allowed";
  }

  return trimmed;
}
