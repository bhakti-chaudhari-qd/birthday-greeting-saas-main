/**
 * Strong password: min 10 characters, OR 8+ with upper, lower, and a number.
 */
export function isStrongPassword(password: string): boolean {
  if (password.length > 128) {
    return false;
  }

  if (password.length >= 10) {
    return true;
  }

  if (password.length < 8) {
    return false;
  }

  return /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password);
}

export const STRONG_PASSWORD_MESSAGE =
  "Password must be at least 10 characters, or at least 8 with uppercase, lowercase, and a number";
