// lib/crypto-vault.js
// Password-protects exported JSON backups using PBKDF2 + AES-256-GCM.

const ITERATIONS = 310000;

function uint8ToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a JSON string with a user password.
 * Returns a JSON string safe to save as a .json backup file.
 */
export async function encryptBackupJson(plainJsonString, password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plainJsonString)
  );

  const payload = {
    recallEncrypted: true,
    version: 1,
    salt: uint8ToBase64(salt),
    iv: uint8ToBase64(iv),
    ciphertext: uint8ToBase64(new Uint8Array(encryptedBuffer))
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Decrypts an encrypted backup JSON string using the user's password.
 * If the backup wasn't encrypted, it returns the original string untouched.
 */
export async function decryptBackupJson(fileContentString, password) {
  const parsed = JSON.parse(fileContentString);
  if (!parsed || !parsed.recallEncrypted) {
    return fileContentString; // Normal unencrypted backup
  }
  if (!password) {
    throw new Error('This backup is encrypted. A password is required to unlock it.');
  }

  const salt = base64ToUint8(parsed.salt);
  const iv = base64ToUint8(parsed.iv);
  const ciphertext = base64ToUint8(parsed.ciphertext);

  const key = await deriveKey(password, salt);
  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    throw new Error('Incorrect password or corrupted backup file.');
  }
}