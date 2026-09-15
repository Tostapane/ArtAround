/**
 * Crea e verifica password con scrypt. Il record conserva algoritmo, parametri,
 * salt e hash perche' il database non deve contenere ne' password ne' salt separati.
 */
import { randomBytes, scrypt, timingSafeEqual } from "crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const MAX_MEMORY = 32 * 1024 * 1024;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      HASH_BYTES,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: MAX_MEMORY },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await deriveKey(password, salt);
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("hex"),
    hash.toString("hex"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const fields = stored.split("$");
  if (fields.length !== 6) return false;

  const [algorithm, n, r, p, saltHex, hashHex] = fields;
  if (algorithm !== "scrypt") return false;
  if (n !== String(SCRYPT_N)) return false;
  if (r !== String(SCRYPT_R)) return false;
  if (p !== String(SCRYPT_P)) return false;
  if (!/^[0-9a-f]{32}$/.test(saltHex)) return false;
  if (!/^[0-9a-f]{64}$/.test(hashHex)) return false;

  const actual = await deriveKey(password, Buffer.from(saltHex, "hex"));
  const expected = Buffer.from(hashHex, "hex");
  return timingSafeEqual(actual, expected);
}
