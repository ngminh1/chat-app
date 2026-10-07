import test from 'node:test';
import assert from 'node:assert/strict';

import ElGamalKeyManager from '../src/utils/elgamal.js';
import {
  generateAESKey,
  exportAESKeyToBase64,
  importAESKeyFromBase64,
  encryptMessage,
  decryptMessage
} from '../src/utils/crypto.js';

test('ElGamal wraps and unwraps an AES key payload', async () => {
  const sender = new ElGamalKeyManager();
  const recipient = new ElGamalKeyManager();
  sender.generateKeyPair();
  const recipientPublic = recipient.generateKeyPair();

  const aesKey = await generateAESKey();
  const base64Key = await exportAESKeyToBase64(aesKey);
  const wrapped = sender.encryptString(base64Key, recipientPublic.y);
  const unwrapped = recipient.decryptString(wrapped);

  assert.equal(unwrapped, base64Key);
});

test('AES-GCM message still decrypts after its key is wrapped by ElGamal', async () => {
  const sender = new ElGamalKeyManager();
  const recipient = new ElGamalKeyManager();
  sender.generateKeyPair();
  const recipientPublic = recipient.generateKeyPair();

  const senderAesKey = await generateAESKey();
  const base64Key = await exportAESKeyToBase64(senderAesKey);
  const wrapped = sender.encryptString(base64Key, recipientPublic.y);
  const recipientAesKey = await importAESKeyFromBase64(recipient.decryptString(wrapped));

  const plaintext = 'Dispatch: Tiếng Việt ổn ✅ 😀 AES-GCM + ElGamal';
  const encrypted = await encryptMessage(plaintext, senderAesKey);
  const decrypted = await decryptMessage(encrypted.ciphertext, encrypted.iv, recipientAesKey);

  assert.equal(decrypted, plaintext);
  assert.equal(encrypted.encryptionVersion, 'AES-256-GCM');
});
