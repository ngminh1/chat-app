import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAESKey, encryptMessage } from '../src/utils/crypto.js';
import { createMessageDecryptor, getReadableMessageText, UNREADABLE_LEGACY_MESSAGE } from '../src/utils/messageDecryption.js';

function setup(getKey) {
  const logs = [];
  return {
    logs,
    decryptor: createMessageDecryptor({
      getKey,
      logger: {
        warn: (...args) => logs.push(['warn', ...args]),
        error: (...args) => logs.push(['error', ...args])
      }
    })
  };
}

async function message(key, content = 'Xin chào test1/test2 👋') {
  return Object.freeze({
    id: 1, conversationId: 7, messageType: 'TEXT', content: null,
    ...await encryptMessage(content, key)
  });
}

test('current messages, replies and conversation previews decrypt without mutating API ciphertext', async () => {
  const key = await generateAESKey();
  const encrypted = await message(key);
  const { decryptor, logs } = setup(async () => key);
  for (const userId of [11, 12]) {
    const result = await decryptor.decryptMessagePayload({ ...encrypted, replyTo: { ...encrypted, messageId: 1 } }, userId);
    assert.equal(result.content, 'Xin chào test1/test2 👋');
    assert.equal(result.replyTo.content, result.content);
    assert.equal(result.decryptionFailed, false);
    assert.equal(result.ciphertext, encrypted.ciphertext);
    const preview = await decryptor.decryptConversationPreview({
      conversationId: 7, type: 'GROUP', lastMessageSenderName: 'Test',
      lastMessageCiphertext: encrypted.ciphertext, lastMessageIv: encrypted.iv,
      lastMessageEncryptionVersion: encrypted.encryptionVersion
    }, userId);
    assert.equal(preview.lastMessage, `Test: ${result.content}`);
  }
  assert.equal(encrypted.content, null);
  assert.equal(logs.length, 0);
});

test('unavailable historical key preserves original ciphertext and returns the exact legacy placeholder', async () => {
  const historicalKey = await generateAESKey();
  const currentKey = await generateAESKey();
  const encrypted = await message(historicalKey);
  const original = JSON.stringify(encrypted);
  let keyRequests = 0;
  const { decryptor, logs } = setup(async () => { keyRequests += 1; return currentKey; });
  const result = await decryptor.decryptMessagePayload(encrypted, 11);
  assert.equal(result.content, UNREADABLE_LEGACY_MESSAGE);
  assert.equal(result.decryptionFailed, true);
  assert.equal(result.decryptionError, 'AUTHENTICATION_FAILED');
  assert.throws(() => getReadableMessageText(result), /Không có plaintext hợp lệ/, 'an unreadable message cannot be edited or forwarded');
  assert.equal(result.ciphertext, encrypted.ciphertext);
  assert.equal(result.iv, encrypted.iv);
  assert.equal(JSON.stringify(encrypted), original);
  assert.equal(keyRequests, 1, 'no key replacement or retry on authentication failure');
  assert.equal(logs[0][0], 'warn');
});

test('one failed envelope logs once across rerenders, reply previews and sidebar but changed ciphertext logs again', async () => {
  const historicalKey = await generateAESKey();
  const { decryptor, logs } = setup(async () => currentKey);
  const currentKey = await generateAESKey();
  const encrypted = await message(historicalKey);
  for (let i = 0; i < 3; i += 1) {
    await decryptor.decryptMessagePayload({ ...encrypted, replyTo: { ...encrypted, messageId: 1 } }, 11);
    await decryptor.decryptConversationPreview({
      conversationId: 7, lastMessageCiphertext: encrypted.ciphertext,
      lastMessageIv: encrypted.iv, lastMessageEncryptionVersion: encrypted.encryptionVersion
    }, 11);
  }
  assert.equal(logs.length, 1);
  const changed = await message(historicalKey, 'Edited historical text');
  await decryptor.decryptMessagePayload(changed, 11);
  assert.equal(logs.length, 2);
  decryptor.clearFailures();
  await decryptor.decryptMessagePayload(encrypted, 11);
  assert.equal(logs.length, 3);
  const serializedLogs = JSON.stringify(logs);
  for (const sensitive of [encrypted.ciphertext, encrypted.iv, 'Edited historical text']) {
    assert.equal(serializedLogs.includes(sensitive), false);
  }
});

test('401, 403 and service errors remain distinct, visible and never serialize request secrets', async () => {
  const encrypted = await message(await generateAESKey());
  let status = 401;
  const { decryptor, logs } = setup(async () => {
    throw { response: { status, data: { key: 'SECRET_KEY' } }, config: { headers: { Authorization: 'SECRET_TOKEN' } } };
  });
  const expected = new Map([
    [401, '[Cần đăng nhập lại để giải mã tin nhắn]'],
    [403, '[Không có quyền giải mã tin nhắn]'],
    [503, '[Tạm thời không thể giải mã tin nhắn]']
  ]);
  for (const [httpStatus, placeholder] of expected) {
    status = httpStatus;
    const result = await decryptor.decryptMessagePayload(encrypted, 11);
    assert.equal(result.content, placeholder);
    assert.equal(result.decryptionError, `HTTP_${httpStatus}`);
    assert.equal(result.decryptionFailed, true);
    await decryptor.decryptMessagePayload(encrypted, 11);
  }
  assert.equal(logs.length, 3);
  assert.ok(logs.every(([level]) => level === 'error'));
  assert.equal(JSON.stringify(logs).includes('SECRET_'), false);
});

test('only the explicit missing-original-key response is a legacy fallback; generic 409/500 stay service errors', async () => {
  const encrypted = await message(await generateAESKey());
  let response = { status: 409, data: { code: 'CONVERSATION_AES_KEY_MISSING' } };
  const { decryptor, logs } = setup(async () => { throw { response }; });
  const missingKey = await decryptor.decryptMessagePayload(encrypted, 11);
  assert.equal(missingKey.content, UNREADABLE_LEGACY_MESSAGE);
  assert.equal(missingKey.decryptionError, 'ORIGINAL_KEY_MISSING');
  assert.throws(() => getReadableMessageText(missingKey), /Không có plaintext hợp lệ/);
  for (const status of [409, 500]) {
    response = { status, data: { code: 'OTHER_ERROR' } };
    const result = await decryptor.decryptMessagePayload(encrypted, 11);
    assert.equal(result.content, '[Tạm thời không thể giải mã tin nhắn]');
    assert.equal(result.decryptionError, `HTTP_${status}`);
  }
  assert.equal(logs.length, 3);
  assert.ok(logs.every(([level]) => level === 'error'));
});

test('successfully decrypted placeholder-like text remains valid text for edit and forward', async () => {
  const key = await generateAESKey();
  const { decryptor } = setup(async () => key);
  const result = await decryptor.decryptMessagePayload(await message(key, UNREADABLE_LEGACY_MESSAGE), 11);
  assert.equal(getReadableMessageText(result), UNREADABLE_LEGACY_MESSAGE);
  assert.equal(result.decryptionFailed, false);
});

test('missing IV, truncated tag and unknown encryptionVersion do not silently render an empty message', async () => {
  const key = await generateAESKey();
  const encrypted = await message(key);
  let keyRequests = 0;
  const { decryptor } = setup(async () => { keyRequests += 1; return key; });
  for (const malformed of [{ ...encrypted, iv: null }, { ...encrypted, ciphertext: 'YWJj' }]) {
    const result = await decryptor.decryptMessagePayload(malformed, 11);
    assert.equal(result.content, UNREADABLE_LEGACY_MESSAGE);
    assert.equal(result.decryptionError, 'INVALID_ENVELOPE');
  }
  const unsupported = await decryptor.decryptMessagePayload({ ...encrypted, encryptionVersion: 'future-cipher' }, 11);
  assert.equal(unsupported.content, '[Không hỗ trợ phiên bản mã hóa tin nhắn]');
  assert.equal(unsupported.decryptionError, 'UNSUPPORTED_VERSION');
  assert.equal(keyRequests, 2);
});

test('plaintext legacy, media and deleted messages do not request keys', async () => {
  const { decryptor, logs } = setup(() => { throw new Error('Unexpected key request'); });
  for (const payload of [
    { messageType: 'TEXT', content: 'Unencrypted legacy text' },
    { messageType: 'IMAGE', mediaUrl: '/api/files/valid.jpg' },
    { messageType: 'TEXT', isDeleted: true, ciphertext: 'ignored', iv: 'ignored', encryptionVersion: 'AES-256-GCM' }
  ]) {
    assert.deepEqual(await decryptor.decryptMessagePayload(payload, 11), payload);
  }
  assert.equal(logs.length, 0);
});
