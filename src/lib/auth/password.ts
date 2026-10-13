import { compare, hash } from "bcryptjs";

const PASSWORD_ROUNDS = 12;

/**
 * A fixed bcrypt hash (of a throwaway string) at the same cost as real
 * passwords. When no account matches, login code runs a comparison against
 * this so a missing account costs the same as a wrong password - otherwise
 * the faster "no user" path leaks which emails/mobiles are registered.
 */
const TIMING_EQUALIZER_HASH =
  "$2b$12$TNaLOyAKMN67GDC6ly2jmu2iZBoZdBjbBryERhdOEnoxyU2RE6mZ6";

export async function hashPassword(password: string): Promise<string> {
  return hash(password, PASSWORD_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return compare(password, passwordHash);
}

/**
 * Spends roughly one password-verification's worth of time without revealing
 * anything. Call on the "account not found" branch of a login so its response
 * time matches a real failed sign-in.
 */
export async function equalizeFailedLoginTiming(
  candidatePassword: string,
): Promise<void> {
  await compare(candidatePassword, TIMING_EQUALIZER_HASH);
}
