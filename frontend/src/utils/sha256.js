// SHA-256 utility dùng Web Crypto API của trình duyệt.
// Dispatch hash phần ENCRYPTED payload, không hash plaintext để tránh làm lộ nội dung.

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildEncryptedPayload(ciphertext, iv, encryptionVersion = 'AES-256-GCM') {
  if (!ciphertext || !iv) {
    throw new Error('Thiếu ciphertext hoặc IV để tính SHA-256');
  }
  return `${encryptionVersion || 'AES-256-GCM'}\n${iv}\n${ciphertext}`;
}

export async function hashSHA256(input) {
  if (input == null) throw new Error('Dữ liệu SHA-256 không được null');
  const data = new TextEncoder().encode(String(input));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

export async function hashEncryptedPayload(ciphertext, iv, encryptionVersion = 'AES-256-GCM') {
  return hashSHA256(buildEncryptedPayload(ciphertext, iv, encryptionVersion));
}

export async function verifyEncryptedPayload(
  ciphertext,
  iv,
  encryptionVersion = 'AES-256-GCM',
  expectedHash
) {
  // Message cũ trước phase SHA không có hash: cho phép đọc để backward compatibility.
  if (!expectedHash) return true;
  if (!/^[0-9a-fA-F]{64}$/.test(expectedHash)) return false;

  const actual = await hashEncryptedPayload(ciphertext, iv, encryptionVersion);
  return actual.toLowerCase() === expectedHash.toLowerCase();
}
