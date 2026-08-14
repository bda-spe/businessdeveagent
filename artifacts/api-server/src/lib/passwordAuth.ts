import { randomBytes, scrypt, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";
import type { CookieOptions } from "express";

const scryptAsync = promisify(scrypt);

const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;

/** Hashes a plaintext password. Format: "<hex salt>:<hex scrypt hash>". */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const derived = (await scryptAsync(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

/** Timing-safe verification against a hash produced by hashPassword(). */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const derived = (await scryptAsync(password, salt, SCRYPT_KEYLEN)) as Buffer;
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** SHA-256 hex digest — used to store session tokens and reset codes so the
 * plaintext value never sits in the database (only the client holds it). */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Cryptographically random URL-safe token for session cookies. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

// Excludes visually ambiguous characters (0/O, 1/I/L) since this is meant to
// be read out of an email and typed back in by hand.
const RESET_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Human-typeable password reset code, e.g. "K7QM4T9XPR". */
export function generateResetCode(length = 10): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += RESET_CODE_ALPHABET[bytes[i] % RESET_CODE_ALPHABET.length];
  }
  return code;
}

export const SESSION_COOKIE_NAME = "bda_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const RESET_CODE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Frontend (app.businessdevagent.com) and backend (api.businessdevagent.com)
 * are different subdomains but the same registrable domain in production, so
 * the session cookie is same-site — SameSite=Lax is sufficient and, unlike
 * SameSite=None, isn't subject to browsers' third-party-cookie blocking.
 * Secure still requires HTTPS, which only holds in production; local dev
 * (both on plain-HTTP localhost) needs secure:false or the cookie silently
 * fails to set.
 */
export function sessionCookieOptions(maxAgeMs: number = SESSION_TTL_MS): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: maxAgeMs,
    path: "/",
  };
}
