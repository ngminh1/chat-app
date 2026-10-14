// Client-only encryption. The recovery code must never be sent to the server.
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ITERATIONS = 600_000;
const KDF = 'PBKDF2-SHA256';
const VERSION = 1;

function toBase64(bytes) {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = '';
  for (const byte of array) str += String.fromCharCode(byte);
  return btoa(str);
}

function fromBase64(text) {
  if (typeof text !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) {
    throw new Error('INVALID_VAULT_FORMAT');
  }
  return Uint8Array.from(atob(text), char => char.charCodeAt(0));
}

export function generateRecoveryCode() {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(32)),
    b => b.toString(16).padStart(2, '0')).join('');
  return hex.match(/.{8}/g).join('-');
}

function normalizeCode(value) {
  const code = String(value ?? '').trim().replace(/[-\s]/g, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(code)) throw new Error('INVALID_RECOVERY_CODE');
  return code;
}

async function derive(code, salt, iterations) {
  const raw = await crypto.subtle.importKey('raw', encoder.encode(normalizeCode(code)),
    'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

const aadFor = publicKey => encoder.encode(`Dispatch:ElGamal:Vault:v1:${publicKey}`);

export async function wrapPrivateKey(privateKey, recoveryCode, publicKey) {
  if (!/^[0-9]+$/.test(String(privateKey)) || !/^[0-9]+$/.test(String(publicKey))) {
    throw new Error('INVALID_KEY_MATERIAL');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(recoveryCode, salt, ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aadFor(publicKey) },
    key, encoder.encode(privateKey)
  );
  return {
    version: VERSION, kdf: KDF, iterations: ITERATIONS,
    salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(ciphertext)
  };
}

export async function unwrapPrivateKey(wrapped, recoveryCode, publicKey) {
  if (wrapped?.version !== VERSION || wrapped?.kdf !== KDF ||
      !Number.isInteger(wrapped?.iterations) || wrapped.iterations < 100_000 ||
      wrapped.iterations > 1_000_000) throw new Error('INVALID_VAULT_FORMAT');
  const salt = fromBase64(wrapped.salt);
  const iv = fromBase64(wrapped.iv);
  const ciphertext = fromBase64(wrapped.ciphertext);
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 17 ||
      ciphertext.length > 10_000) throw new Error('INVALID_VAULT_FORMAT');
  const key = await derive(recoveryCode, salt, wrapped.iterations);
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: aadFor(publicKey) },
      key, ciphertext
    );
    const privateKey = decoder.decode(plaintext);
    if (!/^[0-9]+$/.test(privateKey)) throw new Error('INVALID_KEY_MATERIAL');
    return privateKey;
  } catch {
    throw new Error('WRONG_RECOVERY_CODE_OR_DAMAGED_VAULT');
  }
}
