// Serviço de hash e verificação de senha com scrypt nativo.
const crypto = require("crypto");

const SALT_BYTES = 16;
const KEY_LENGTH = 64;
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      KEY_LENGTH,
      {
        N: COST,
        r: BLOCK_SIZE,
        p: PARALLELIZATION
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      }
    );
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES).toString("hex");
  const derivedKey = await scryptAsync(password, salt);
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
  if (!storedHash?.startsWith("scrypt:")) {
    return false;
  }

  const [, salt, originalHash] = storedHash.split(":");
  const derivedKey = await scryptAsync(password, salt);
  const originalBuffer = Buffer.from(originalHash, "hex");

  if (originalBuffer.length !== derivedKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(originalBuffer, derivedKey);
}

module.exports = {
  hashPassword,
  verifyPassword
};
