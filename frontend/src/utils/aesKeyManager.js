import axios from 'axios';
import { API_BASE } from '../config/api';
import { createConversationKeyCache } from './conversationKeyCache.js';

// Cache key trong RAM để tránh gọi backend mỗi lần encrypt/decrypt.
const keyCache = createConversationKeyCache(async (conversationId, userId) => {
  const response = await axios.get(
    `${API_BASE}/chat/conversations/${conversationId}/aes-key`,
    { params: { userId } }
  );
  return response.data;
});

/**
 * Backend xác thực thành viên rồi trả khóa AES hiện có theo conversationId.
 * Bản bọc ElGamal được xử lý ở backend; backend vẫn biết khóa nên CHƯA PHẢI E2EE.
 * Client chỉ cache trong RAM, không tạo hoặc thay khóa khi giải mã thất bại.
 */
export async function getConversationAESKey(conversationId, userId) {
  return keyCache.get(conversationId, userId);
}

export function clearAESKeyCache() {
  keyCache.clear();
}
