import crypto from 'node:crypto';

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function deriveHash(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey.toString('hex'));
    });
  });
}

function deriveHashSync(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex');
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  const actualHash = await deriveHash(password, salt);
  const left = Buffer.from(actualHash, 'hex');
  const right = Buffer.from(expectedHash, 'hex');

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

export async function createPasswordHash(password: string): Promise<{ salt: string; hash: string }> {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  const hash = await deriveHash(password, salt);
  return { salt, hash };
}

export function createPasswordHashSync(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  const hash = deriveHashSync(password, salt);
  return { salt, hash };
}
