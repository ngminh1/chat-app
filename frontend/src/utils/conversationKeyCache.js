import { importAESKeyFromBase64 } from './crypto.js';

// Store the pending import as well as its result: a history load needs one request,
// even when messages, replies and the sidebar all request the same key at once.
export function createConversationKeyCache(fetchKey) {
  const entries = new Map();
  let session = 0;

  return {
    async get(conversationId, userId) {
      if (!conversationId) throw new Error('Thiếu conversationId');
      if (!userId) throw new Error('Thiếu userId');
      // HOC KHOA: Tach cache theo nguoi dung va cuoc tro chuyen.
      const cacheKey = `${userId}:${conversationId}`;
      if (entries.has(cacheKey)) return entries.get(cacheKey);

      const requestSession = session;
      const pending = (async () => {
        const response = await fetchKey(conversationId, userId);
        if (String(response?.conversationId) !== String(conversationId) || !response?.key) {
          throw new Error('Backend trả về khóa hội thoại không hợp lệ');
        }
        const key = await importAESKeyFromBase64(response.key);
        if (requestSession !== session) {
          const error = new Error('Phiên lấy khóa hội thoại đã kết thúc');
          error.name = 'AESKeySessionChangedError';
          throw error;
        }
        return key;
      })();
      entries.set(cacheKey, pending);
      try {
        return await pending;
      } catch (error) {
        // A failed request can be retried by a later user action. Do not remove a
        // newer session's entry when an older in-flight request finally settles.
        if (entries.get(cacheKey) === pending) entries.delete(cacheKey);
        throw error;
      }
    },
    // HOC KHOA: Logout tang session, response lay khoa cu khong duoc dua sang phien moi.
    clear() {
      session += 1;
      entries.clear();
    }
  };
}
