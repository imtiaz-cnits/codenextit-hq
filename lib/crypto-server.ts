import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";

function getEncryptionKey(): Buffer {
  const rawKey = process.env.VAULT_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error("Missing VAULT_ENCRYPTION_KEY environment variable. Vault operations are disabled.");
  }
  // Standardize the key length to 32 bytes using SHA-256 hash of the configured key.
  return crypto.createHash("sha256").update(rawKey).digest();
}

/**
 * Encrypts a plain-text password using AES-256-CBC.
 * Returns the hex iv and ciphertext separated by a colon (iv:ciphertext).
 */
export function encryptPassword(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an AES-256-CBC encrypted password.
 * Expects the format 'iv:ciphertext'.
 */
export function decryptPassword(encryptedText: string): string {
  const key = getEncryptionKey();
  const parts = encryptedText.split(":");
  const ivHex = parts[0];
  const encrypted = parts[1];
  if (!ivHex || !encrypted) {
    throw new Error("Invalid encrypted text format.");
  }
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
