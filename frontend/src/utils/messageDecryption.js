import { AES_ENCRYPTION_VERSION, decryptMessage } from './crypto.js';

export const UNREADABLE_LEGACY_MESSAGE = '[Không thể giải mã tin nhắn cũ]';
const TEMPORARY_FAILURE = '[Tạm thời không thể giải mã tin nhắn]';

// Reusing a display fallback as plaintext would permanently replace history on
// edit, or manufacture a new encrypted message on forward.
export function getReadableMessageText(message) {
  if (!message || message.messageType !== 'TEXT' || message.decryptionFailed || typeof message.content !== 'string') {
    throw new Error('Không có plaintext hợp lệ để chỉnh sửa hoặc chuyển tiếp');
  }
  return message.content;
}

function describeFailure(error, stage) {
  if (error?.name === 'AESKeySessionChangedError') {
    return { reason: 'SESSION_CHANGED', content: TEMPORARY_FAILURE };
  }
  if (stage === 'key') {
    const status = error?.response?.status;
    if (status === 409 && error?.response?.data?.code === 'CONVERSATION_AES_KEY_MISSING') {
      return { reason: 'ORIGINAL_KEY_MISSING', content: UNREADABLE_LEGACY_MESSAGE };
    }
    if (status === 401) return { reason: 'HTTP_401', content: '[Cần đăng nhập lại để giải mã tin nhắn]' };
    if (status === 403) return { reason: 'HTTP_403', content: '[Không có quyền giải mã tin nhắn]' };
    return { reason: Number.isInteger(status) ? `HTTP_${status}` : 'KEY_UNAVAILABLE', content: TEMPORARY_FAILURE };
  }
  if (error?.name === 'OperationError') {
    return { reason: 'AUTHENTICATION_FAILED', content: UNREADABLE_LEGACY_MESSAGE };
  }
  if (error?.name === 'InvalidCiphertextError') {
    return { reason: 'INVALID_ENVELOPE', content: UNREADABLE_LEGACY_MESSAGE };
  }
  return { reason: 'DECRYPT_FAILED', content: TEMPORARY_FAILURE };
}

// Failures are deduplicated across message/reply/sidebar views by the encrypted
// envelope, user and failure type. Changed ciphertext or a different HTTP error
// is a new failure. Never log an Axios error/config, key, IV or message content.
export function createMessageDecryptor({ getKey, logger = console }) {
  const reportedFailures = new Set();

  function report(envelope, userId, failure) {
    if (failure.reason === 'SESSION_CHANGED') return;
    const identity = JSON.stringify([
      userId, envelope.conversationId, envelope.ciphertext, envelope.iv,
      envelope.encryptionVersion, failure.reason
    ]);
    if (reportedFailures.has(identity)) return;
    reportedFailures.add(identity);
    const safeId = (id) => Number.isSafeInteger(Number(id)) && Number(id) > 0 ? Number(id) : 'unknown';
    const context = `conversation ${safeId(envelope.conversationId)}, message ${safeId(envelope.id)}`;
    if (failure.reason === 'AUTHENTICATION_FAILED' || failure.reason === 'INVALID_ENVELOPE') {
      logger.warn(`Không thể giải mã AES-GCM (${context}; ${failure.reason}); giữ nguyên ciphertext trên server.`);
    } else {
      logger.error(`Không thể giải mã (${context}; ${failure.reason}).`);
    }
  }

  async function readEnvelope(envelope, userId) {
    let stage = 'key';
    let failure;
    if (envelope.encryptionVersion !== AES_ENCRYPTION_VERSION) {
      failure = { reason: 'UNSUPPORTED_VERSION', content: '[Không hỗ trợ phiên bản mã hóa tin nhắn]' };
    } else {
      try {
        const key = await getKey(envelope.conversationId, userId);
        stage = 'decrypt';
        const content = await decryptMessage(envelope.ciphertext, envelope.iv, key);
        return { content, decryptionFailed: false, decryptionError: null };
      } catch (error) {
        failure = describeFailure(error, stage);
      }
    }
    report(envelope, userId, failure);
    return { content: failure.content, decryptionFailed: true, decryptionError: failure.reason };
  }

  const hasEnvelope = (value) => value.ciphertext != null || value.iv != null || value.encryptionVersion != null;

  return {
    clearFailures() {
      reportedFailures.clear();
    },
    async decryptMessagePayload(message, userId) {
      if (!message || message.isDeleted) return message;
      const result = { ...message };
      if (result.replyTo && hasEnvelope(result.replyTo)) {
        const reply = result.replyTo;
        result.replyTo = {
          ...reply,
          ...await readEnvelope({ ...reply, id: reply.messageId ?? reply.id, conversationId: result.conversationId }, userId)
        };
      }
      if (result.messageType === 'TEXT' && hasEnvelope(result)) {
        Object.assign(result, await readEnvelope(result, userId));
      }
      return result;
    },
    async decryptConversationPreview(conversation, userId) {
      if (!conversation) return conversation;
      const envelope = {
        conversationId: conversation.conversationId,
        ciphertext: conversation.lastMessageCiphertext,
        iv: conversation.lastMessageIv,
        encryptionVersion: conversation.lastMessageEncryptionVersion
      };
      if (!hasEnvelope(envelope)) return conversation;
      const decrypted = await readEnvelope(envelope, userId);
      const prefix = !decrypted.decryptionFailed && conversation.type === 'GROUP' && conversation.lastMessageSenderName
        ? `${conversation.lastMessageSenderName}: ` : '';
      return { ...conversation, lastMessage: prefix + decrypted.content };
    }
  };
}
