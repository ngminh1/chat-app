import assert from 'node:assert/strict';
globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');

const {
  generateAESKey,
  encryptMessage,
  decryptMessage
} = await import('../src/utils/crypto.js');
const {
  hashEncryptedPayload,
  verifyEncryptedPayload
} = await import('../src/utils/sha256.js');

const key = await generateAESKey();
const plaintext = 'Dispatch SHA-256: Tiếng Việt 😀';
const encrypted = await encryptMessage(plaintext, key);

assert.match(encrypted.sha256, /^[0-9a-f]{64}$/);
assert.equal(
  encrypted.sha256,
  await hashEncryptedPayload(encrypted.ciphertext, encrypted.iv, encrypted.encryptionVersion)
);
assert.equal(
  await verifyEncryptedPayload(encrypted.ciphertext, encrypted.iv, encrypted.encryptionVersion, encrypted.sha256),
  true
);
assert.equal(
  await decryptMessage(encrypted.ciphertext, encrypted.iv, key, encrypted.sha256),
  plaintext
);

const tampered = encrypted.ciphertext.slice(0, -1) + (encrypted.ciphertext.endsWith('A') ? 'B' : 'A');
assert.equal(
  await verifyEncryptedPayload(tampered, encrypted.iv, encrypted.encryptionVersion, encrypted.sha256),
  false
);
await assert.rejects(
  () => decryptMessage(tampered, encrypted.iv, key, encrypted.sha256),
  /SHA-256 không khớp/
);

// Legacy message trước phase SHA vẫn decrypt được nếu sha256 = null.
assert.equal(
  await decryptMessage(encrypted.ciphertext, encrypted.iv, key, null),
  plaintext
);

console.log('PASS crypto-sha: hash/verify/decrypt/tamper/legacy');
console.log(encrypted.sha256);
