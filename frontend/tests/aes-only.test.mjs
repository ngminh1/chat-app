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

test('GCM uses a 128-bit authentication tag, including for empty text', async () => {
  const key = await generateAESKey();
  const payload = await encryptMessage('', key);
  assert.equal(Buffer.from(payload.ciphertext, 'base64').length, 16);
  assert.equal(await decryptMessage(payload.ciphertext, payload.iv, key), '');
  const damagedTag = Buffer.from(payload.ciphertext, 'base64');
  damagedTag[15] ^= 1;
  await assert.rejects(decryptMessage(damagedTag.toString('base64'), payload.iv, key), { name: 'OperationError' });
});

test('invalid IV, base64 or a missing authentication tag are rejected explicitly', async () => {
  const key = await generateAESKey();
  const payload = await encryptMessage('safe', key);
  for (const [ciphertext, iv] of [
    [payload.ciphertext, 'YWJj'], ['not base64!', payload.iv], ['YWJj', payload.iv], [null, payload.iv]
  ]) {
    await assert.rejects(decryptMessage(ciphertext, iv, key), { name: 'InvalidCiphertextError' });
  }
});
