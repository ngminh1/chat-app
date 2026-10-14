// AES-256-GCM utility dùng Web Crypto API của trình duyệt.
// File này CHỈ xử lý AES: encode/decode, encrypt/decrypt, import/export key.
// Không chứa ElGamal, SHA hoặc public/private key.

const AES_NAME = 'AES-GCM';
const AES_KEY_LENGTH = 256;
const GCM_IV_LENGTH = 12; // 96 bit - kích thước IV khuyến nghị cho GCM
const GCM_TAG_LENGTH = 128;
export const AES_ENCRYPTION_VERSION = 'AES-256-GCM';

function invalidCiphertext() {
  const error = new Error('Ciphertext hoặc IV AES-GCM không hợp lệ');
  error.name = 'InvalidCiphertextError';
  return error;
}

export function textToBytes(text) {
  return new TextEncoder().encode(text ?? '');
}

export function bytesToText(bytes) {
  return new TextDecoder().decode(bytes);
}

// HOC AES: IV 96 bit phai moi cho moi lan ma hoa voi cung khoa; IV khong can bi mat.
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

// HOC AES: UTF-8 -> Web Crypto AES-GCM -> ciphertext + tag 16 byte, IV va version (Base64).
export async function encryptMessage(plaintext, key) {
  if (!key) throw new Error('Thiếu AES key');

  const iv = generateIV();
  const data = textToBytes(plaintext);

  // Web Crypto trả về ArrayBuffer chứa ciphertext + authentication tag của GCM.
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: AES_NAME,
      iv,
      tagLength: GCM_TAG_LENGTH
    },
    key,
    data
  );

  return {
    ciphertext: bytesToBase64(encryptedBuffer),
    iv: bytesToBase64(iv),
    encryptionVersion: AES_ENCRYPTION_VERSION
  };
}

// HOC AES: Sai khoa, IV hay tag se that bai xac thuc; khong tu tao khoa moi cho tin lich su.
export async function decryptMessage(ciphertextBase64, ivBase64, key) {
  if (!key) throw new Error('Thiếu AES key');
  if (!ciphertextBase64 || !ivBase64) throw invalidCiphertext();

  let ciphertext;
  let iv;
  try {
    ciphertext = base64ToBytes(ciphertextBase64);
    iv = base64ToBytes(ivBase64);
  } catch {
    throw invalidCiphertext();
  }

  if (iv.byteLength !== GCM_IV_LENGTH || ciphertext.byteLength < GCM_TAG_LENGTH / 8) {
    throw invalidCiphertext();
  }

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: AES_NAME,
      iv,
      tagLength: GCM_TAG_LENGTH
    },
    key,
    ciphertext
  );

  return bytesToText(decryptedBuffer);
}
