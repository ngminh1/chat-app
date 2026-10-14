import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRecoveryCode, wrapPrivateKey, unwrapPrivateKey } from '../src/utils/keyVault.js';

test('recovery code generates 256 bits of hex', () => {
  const code = generateRecoveryCode();
  assert.match(code, /^[0-9a-f]{8}(?:-[0-9a-f]{8}){7}$/);
  assert.notEqual(generateRecoveryCode(), code);
});

test('vault round trip and wrong-code rejection', async () => {
  const code = generateRecoveryCode();
  const blob = await wrapPrivateKey('123456789123456789', code, '999999');
  assert.notEqual(blob.ciphertext, '123456789123456789');
  assert.equal(blob.iterations, 600_000);
  assert.equal(await unwrapPrivateKey(blob, code, '999999'), '123456789123456789');
  await assert.rejects(() => unwrapPrivateKey(blob, generateRecoveryCode(), '999999'));
  await assert.rejects(() => unwrapPrivateKey(blob, code, '999998'));
});

test('tampered ciphertext fails GCM authentication', async () => {
  const code = generateRecoveryCode();
  const blob = await wrapPrivateKey('123456789123456789', code, '999999');
  const raw = Buffer.from(blob.ciphertext, 'base64');
  raw[0] ^= 1;
  await assert.rejects(() => unwrapPrivateKey({ ...blob, ciphertext: raw.toString('base64') }, code, '999999'));
});
