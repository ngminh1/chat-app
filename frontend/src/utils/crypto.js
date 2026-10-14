// AES-256-GCM utility dùng Web Crypto API của trình duyệt.
// File này CHỈ xử lý AES: encode/decode, encrypt/decrypt, import/export key.
// Không chứa ElGamal, SHA hoặc public/private key.

const AES_NAME = 'AES-GCM';
const AES_KEY_LENGTH = 256;
const GCM_IV_LENGTH = 12; // 96 bit - kích thước IV khuyến nghị cho GCM

export function textToBytes(text) {
  return new TextEncoder().encode(text ?? '');
}

export function bytesToText(bytes) {
  return new TextDecoder().decode(bytes);
}

export function generateIV() {
  return crypto.getRandomValues(new Uint8Array(GCM_IV_LENGTH));
}

export async function generateAESKey() {
  return crypto.subtle.generateKey(
    {
      name: AES_NAME,
      length: AES_KEY_LENGTH
    },
    true,
    ['encrypt', 'decrypt']
  );
}

export function bytesToBase64(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function exportAESKeyToBase64(key) {
  const raw = await crypto.subtle.exportKey('raw', key);
  return bytesToBase64(raw);
}

export async function importAESKeyFromBase64(base64Key) {
  const raw = base64ToBytes(base64Key);
  if (raw.byteLength !== 32) {
    throw new Error(`AES-256 key phải dài 32 byte, hiện tại là ${raw.byteLength} byte`);
  }

  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: AES_NAME },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptMessage(plaintext, key) {
  if (!key) throw new Error('Thiếu AES key');

  const iv = generateIV();
  const data = textToBytes(plaintext);

  // Web Crypto trả về ArrayBuffer chứa ciphertext + authentication tag của GCM.
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: AES_NAME,
      iv
    },
    key,
    data
  );

  return {
    ciphertext: bytesToBase64(encryptedBuffer),
    iv: bytesToBase64(iv),
    encryptionVersion: 'AES-256-GCM'
  };
}

export async function decryptMessage(ciphertextBase64, ivBase64, key) {
  if (!key) throw new Error('Thiếu AES key');
  if (!ciphertextBase64 || !ivBase64) throw new Error('Thiếu ciphertext hoặc IV');

  const ciphertext = base64ToBytes(ciphertextBase64);
  const iv = base64ToBytes(ivBase64);

  if (iv.byteLength !== GCM_IV_LENGTH) {
    throw new Error(`IV AES-GCM phải dài ${GCM_IV_LENGTH} byte`);
  }

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: AES_NAME,
      iv
    },
    key,
    ciphertext
  );

  return bytesToText(decryptedBuffer);
}
