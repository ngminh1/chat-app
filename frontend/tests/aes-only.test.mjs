import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAESKey, encryptMessage, decryptMessage } from '../src/utils/crypto.js';

test('AES-256-GCM round trips Vietnamese text without plaintext in payload', async () => {
  const key = await generateAESKey();
  const plaintext = 'Xin chào Dispatch 👋\nDòng thứ hai';
  const payload = await encryptMessage(plaintext, key);
  assert.equal(payload.encryptionVersion, 'AES-256-GCM');
  assert.equal(Buffer.from(payload.iv, 'base64').length, 12);
  assert.equal(JSON.stringify(payload).includes(plaintext), false);
  assert.equal(await decryptMessage(payload.ciphertext, payload.iv, key), plaintext);
});

test('each encryption uses a new IV and tampering fails authentication', async () => {
  const key = await generateAESKey();
  const first = await encryptMessage('same message', key);
  const second = await encryptMessage('same message', key);
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
  const altered = Buffer.from(first.ciphertext, 'base64');
  altered[0] ^= 1;
  await assert.rejects(() => decryptMessage(altered.toString('base64'), first.iv, key));
});
