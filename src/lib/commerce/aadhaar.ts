import crypto from "node:crypto";

/*
 * Aadhaar handling for dealer KYC (DPDP Act 2023 + UIDAI rules):
 *  - the full Aadhaar number is never stored; only the last 4 digits (masked display),
 *  - the uploaded card image/PDF is encrypted with AES-256-GCM in the app before it reaches storage,
 *    so the storage bucket only ever holds ciphertext,
 *  - only admins can decrypt, every view is written to the audit log.
 */

const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** Aadhaar numbers are 12 digits, do not start with 0 or 1, and end in a Verhoeff check digit. */
export function isValidAadhaar(raw: string): boolean {
  const n = raw.replace(/[\s-]/g, "");
  if (!/^[2-9]\d{11}$/.test(n)) return false;
  let c = 0;
  const digits = n.split("").reverse().map(Number);
  for (let i = 0; i < digits.length; i++) c = D[c][P[i % 8][digits[i]]];
  return c === 0;
}

export const aadhaarLast4 = (raw: string) => raw.replace(/\D/g, "").slice(-4);

function key(b64: string): Buffer {
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("AADHAAR_ENCRYPTION_KEY must be 32 bytes, base64 encoded");
  return k;
}

const MAGIC = Buffer.from("HLK1"); // format/version tag

/** AES-256-GCM: output = "HLK1" | iv(12) | tag(16) | ciphertext. `aad` binds the file to its dealer. */
export function encryptFile(plain: Buffer, keyB64: string, aad: string): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(keyB64), iv);
  cipher.setAAD(Buffer.from(aad));
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), data]);
}

export function decryptFile(blob: Buffer, keyB64: string, aad: string): Buffer {
  if (!blob.subarray(0, 4).equals(MAGIC)) throw new Error("Not an encrypted KYC file");
  const iv = blob.subarray(4, 16);
  const tag = blob.subarray(16, 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(keyB64), iv);
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(blob.subarray(32)), decipher.final()]);
}

/** Sniff the real file type from its first bytes (never trust the browser's MIME type). */
export function sniffKycType(buf: Buffer): "image/jpeg" | "image/png" | "application/pdf" | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}
