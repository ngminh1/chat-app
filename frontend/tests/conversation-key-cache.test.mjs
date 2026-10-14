import test from 'node:test';
import assert from 'node:assert/strict';
import { createConversationKeyCache } from '../src/utils/conversationKeyCache.js';
import { generateAESKey, exportAESKeyToBase64, encryptMessage, decryptMessage } from '../src/utils/crypto.js';

async function encodedKey() {
  return exportAESKeyToBase64(await generateAESKey());
}

test('concurrent conversation requests import one original key and scope cache by user', async () => {
  const key = await encodedKey();
  let requests = 0;
  const cache = createConversationKeyCache(async (conversationId) => {
    requests += 1;
    return { conversationId, key };
  });
  const keys = await Promise.all(Array.from({ length: 10 }, () => cache.get(7, 11)));
  assert.equal(requests, 1);
  assert.ok(keys.every((value) => value === keys[0]));
  const secondUserKey = await cache.get(7, 12);
  assert.equal(requests, 2);
  const encrypted = await encryptMessage('shared conversation', keys[0]);
  assert.equal(await decryptMessage(encrypted.ciphertext, encrypted.iv, secondUserKey), 'shared conversation');
});

test('clearing cache prevents late key responses from restoring or replacing a newer session entry', async () => {
  const key = await encodedKey();
  let resolveOld;
  let requests = 0;
  const cache = createConversationKeyCache((conversationId) => {
    requests += 1;
    if (requests === 1) return new Promise((resolve) => { resolveOld = resolve; });
    return Promise.resolve({ conversationId, key });
  });
  const oldRequest = cache.get(7, 11);
  const rejected = assert.rejects(oldRequest, { name: 'AESKeySessionChangedError' });
  cache.clear();
  const currentKey = await cache.get(7, 11);
  resolveOld({ conversationId: 7, key });
  await rejected;
  assert.equal(await cache.get(7, 11), currentKey);
  assert.equal(requests, 2);
});

test('failed key fetch is not cached and a later explicit request can succeed', async () => {
  const key = await encodedKey();
  let requests = 0;
  const cache = createConversationKeyCache(async (conversationId) => {
    requests += 1;
    if (requests === 1) throw { response: { status: 503 } };
    return { conversationId, key };
  });
  await assert.rejects(cache.get(7, 11), (error) => error.response.status === 503);
  assert.equal(requests, 1, 'no automatic retry');
  await cache.get(7, 11);
  assert.equal(requests, 2);
});

test('wrong conversation metadata and invalid key material fail without generating replacements', async () => {
  const key = await encodedKey();
  const wrongConversation = createConversationKeyCache(async () => ({ conversationId: 8, key }));
  const invalidKey = createConversationKeyCache(async () => ({ conversationId: 7, key: 'YWJj' }));
  await assert.rejects(wrongConversation.get(7, 11), /khóa hội thoại không hợp lệ/);
  await assert.rejects(invalidKey.get(7, 11), /32 byte/);
});
