import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const PASSWORD_HASH_ALGORITHM = 'scrypt';
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_SALT_BYTES = 16;

export async function hashPassword(password) {
  const salt = randomBytes(PASSWORD_SALT_BYTES).toString('base64url');
  const derivedKey = await scryptAsync(password, salt, PASSWORD_KEY_LENGTH);

  return [
    PASSWORD_HASH_ALGORITHM,
    salt,
    Buffer.from(derivedKey).toString('base64url')
  ].join('$');
}

export async function verifyPassword(password, passwordHash) {
  const [algorithm, salt, storedKey] = passwordHash.split('$');

  if (algorithm !== PASSWORD_HASH_ALGORITHM || !salt || !storedKey) {
    return false;
  }

  const derivedKey = await scryptAsync(password, salt, PASSWORD_KEY_LENGTH);
  const storedBuffer = Buffer.from(storedKey, 'base64url');
  const derivedBuffer = Buffer.from(derivedKey);

  return (
    storedBuffer.length === derivedBuffer.length &&
    timingSafeEqual(storedBuffer, derivedBuffer)
  );
}
