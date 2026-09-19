import axios from 'axios';
import { API_BASE } from '../config/api';
import { importAESKeyFromBase64 } from './crypto';

// Cache key trong RAM để tránh gọi backend mỗi lần encrypt/decrypt.
const keyCache = new Map();

/**
 * DEV AES KEY MANAGER.
 *
 * Phase này chỉ học AES nên backend lưu raw AES key Base64 theo conversationId
 * và trả cùng key cho mọi thành viên của conversation.
 *
 * HẬU QUẢ: backend biết AES key => CHƯA PHẢI E2EE.
 * Sau này khi học ElGamal/key exchange thì thay lớp này, phần encrypt/decrypt AES
 * phía trên gần như giữ nguyên.
 */
export async function getConversationAESKey(conversationId, userId) {
  if (!conversationId) throw new Error('Thiếu conversationId');
  if (!userId) throw new Error('Thiếu userId');

  const cacheKey = String(conversationId);
  if (keyCache.has(cacheKey)) {
    return keyCache.get(cacheKey);
  }

  const res = await axios.get(
    `${API_BASE}/chat/conversations/${conversationId}/aes-key`,
    { params: { userId } }
  );

  const base64Key = res.data?.key;
  if (!base64Key) {
    throw new Error('Backend không trả về AES key');
  }

  const cryptoKey = await importAESKeyFromBase64(base64Key);
  keyCache.set(cacheKey, cryptoKey);
  return cryptoKey;
}

export function clearAESKeyCache() {
  keyCache.clear();
}
