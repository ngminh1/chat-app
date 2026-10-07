import axios from 'axios';
import { API_BASE } from '../config/api';
import {
  exportAESKeyToBase64,
  importAESKeyFromBase64
} from './crypto';
import ElGamalKeyManager, { ELGAMAL_KEY_VERSION } from './elgamal';

// Cache AES key trong RAM. Key theo user + conversation để tránh lẫn khi đổi account trên cùng browser.
const keyCache = new Map();
const keyLoadPromises = new Map();
const identityCache = new Map();
const identityRegistrationPromises = new Map();

const ELGAMAL_STORAGE_PREFIX = 'dispatch_elgamal_private_v1_';

function cryptoRequestConfig(extra = {}) {
  const token = localStorage.getItem('auth_token');
  if (!token) throw new Error('Thiếu JWT khi gọi crypto key API');

  return {
    ...extra,
    headers: {
      ...(extra.headers || {}),
      Authorization: `Bearer ${token}`
    }
  };
}

function identityStorageKey(userId) {
  return `${ELGAMAL_STORAGE_PREFIX}${userId}`;
}

function getOrCreateLocalIdentity(userId) {
  const cacheKey = String(userId);
  if (identityCache.has(cacheKey)) return identityCache.get(cacheKey);

  const manager = new ElGamalKeyManager();
  const savedPrivateKey = localStorage.getItem(identityStorageKey(userId));

  if (savedPrivateKey) {
    manager.importPrivateKey(savedPrivateKey);
  } else {
    manager.generateKeyPair();
    // Demo/assignment persistence. Không xóa khi logout nếu không sẽ mất khả năng giải mã lịch sử.
    localStorage.setItem(identityStorageKey(userId), manager.exportPrivateKey());
  }

  identityCache.set(cacheKey, manager);
  return manager;
}

/**
 * Đảm bảo user có cặp ElGamal local và public key tương ứng trên backend.
 * Backend từ chối ghi đè nếu tài khoản đã có public key khác để tránh làm mất lịch sử.
 */
export async function ensureElGamalIdentity(userId) {
  if (!userId) throw new Error('Thiếu userId khi khởi tạo ElGamal identity');

  const identityKey = String(userId);
  if (identityRegistrationPromises.has(identityKey)) {
    return identityRegistrationPromises.get(identityKey);
  }

  const registrationPromise = (async () => {
    const manager = getOrCreateLocalIdentity(userId);
    const publicInfo = manager.getPublicKeyInfo();

    try {
      await axios.put(
        `${API_BASE}/users/${userId}/elgamal-public-key`,
        { publicKey: publicInfo.y, keyVersion: publicInfo.keyVersion },
        cryptoRequestConfig()
      );
    } catch (err) {
      if (err.response?.status === 409) {
        throw new Error(
          'ElGamal key của tài khoản trên server khác key của trình duyệt này. ' +
          'Không tạo key mới để tránh mất khả năng giải mã lịch sử.'
        );
      }
      throw err;
    }

    return manager;
  })();

  identityRegistrationPromises.set(identityKey, registrationPromise);
  try {
    return await registrationPromise;
  } catch (err) {
    identityRegistrationPromises.delete(identityKey);
    throw err;
  }
}

export async function getUserElGamalPublicKey(userId) {
  try {
    const res = await axios.get(
      `${API_BASE}/users/${userId}/elgamal-public-key`,
      cryptoRequestConfig()
    );
    if (!res.data?.publicKey) throw new Error('User chưa có ElGamal public key');
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) {
      throw new Error('Người dùng chưa khởi tạo ElGamal key. Họ cần đăng nhập Dispatch ít nhất một lần.');
    }
    throw err;
  }
}

async function getWrappedKey(conversationId) {
  const res = await axios.get(
    `${API_BASE}/chat/conversations/${conversationId}/wrapped-key`,
    cryptoRequestConfig()
  );

  if (res.status === 204 || !res.data?.c1 || !res.data?.c2) return null;
  return res.data;
}

async function migrateLegacyAesKey(conversationId, manager) {
  // Backend chỉ cho endpoint này sinh/trả raw key nếu conversation chưa migrate.
  const rawRes = await axios.get(
    `${API_BASE}/chat/conversations/${conversationId}/aes-key`,
    cryptoRequestConfig()
  );

  const base64Key = rawRes.data?.key;
  if (!base64Key) throw new Error('Backend không trả về AES migration key');

  const memberRes = await axios.get(
    `${API_BASE}/chat/conversations/${conversationId}/crypto-members`,
    cryptoRequestConfig()
  );

  const wrappedKeys = (memberRes.data || [])
    .filter((member) => member.publicKey)
    .map((member) => {
      const cipher = manager.encryptString(base64Key, member.publicKey);
      return {
        userId: member.userId,
        c1: cipher.c1,
        c2: cipher.c2,
        keyVersion: member.keyVersion || ELGAMAL_KEY_VERSION
      };
    });

  if (wrappedKeys.length > 0) {
    await axios.post(
      `${API_BASE}/chat/conversations/${conversationId}/wrapped-keys`,
      { keys: wrappedKeys },
      cryptoRequestConfig()
    );
  }

  return base64Key;
}

/**
 * Trả CryptoKey AES-256 của conversation.
 * Ưu tiên: wrapped key ElGamal -> decrypt local -> import AES.
 * Fallback migration: lấy raw key cũ đúng một giai đoạn, wrap cho các member có public key,
 * rồi backend xóa raw key khi mọi member đã được wrap.
 */
export async function getConversationAESKey(conversationId, userId) {
  if (!conversationId) throw new Error('Thiếu conversationId');
  if (!userId) throw new Error('Thiếu userId');

  const cacheKey = `${userId}:${conversationId}`;
  if (keyCache.has(cacheKey)) return keyCache.get(cacheKey);
  if (keyLoadPromises.has(cacheKey)) return keyLoadPromises.get(cacheKey);

  const loadPromise = (async () => {
    const manager = await ensureElGamalIdentity(userId);
    const wrappedKey = await getWrappedKey(conversationId);

    let base64Key;
    if (wrappedKey) {
      if (wrappedKey.keyVersion && wrappedKey.keyVersion !== ELGAMAL_KEY_VERSION) {
        throw new Error(`Không hỗ trợ ElGamal key version ${wrappedKey.keyVersion}`);
      }
      base64Key = manager.decryptString(wrappedKey);
    } else {
      base64Key = await migrateLegacyAesKey(conversationId, manager);
    }

    const cryptoKey = await importAESKeyFromBase64(base64Key);
    keyCache.set(cacheKey, cryptoKey);
    return cryptoKey;
  })();

  keyLoadPromises.set(cacheKey, loadPromise);
  try {
    return await loadPromise;
  } finally {
    keyLoadPromises.delete(cacheKey);
  }
}

/**
 * Dùng khi thêm thành viên vào group đã migrate: client hiện tại đang có AES key,
 * nên wrap key đó bằng public key ElGamal của thành viên mới trước khi backend thêm member.
 */
export async function wrapConversationKeyForUser(conversationId, currentUserId, targetUserId) {
  const manager = await ensureElGamalIdentity(currentUserId);
  const aesKey = await getConversationAESKey(conversationId, currentUserId);
  const base64Key = await exportAESKeyToBase64(aesKey);
  const target = await getUserElGamalPublicKey(targetUserId);
  const cipher = manager.encryptString(base64Key, target.publicKey);

  return {
    userId: targetUserId,
    c1: cipher.c1,
    c2: cipher.c2,
    keyVersion: target.keyVersion || ELGAMAL_KEY_VERSION
  };
}

export function clearAESKeyCache() {
  keyCache.clear();
  keyLoadPromises.clear();
}
