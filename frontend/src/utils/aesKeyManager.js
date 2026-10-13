
import axios from 'axios';
import { API_BASE } from '../config/api';
import { importAESKeyFromBase64 } from './crypto';
import ElGamalKeyManager, { ELGAMAL_KEY_VERSION } from './elgamal';

// Cache AES key trong RAM theo user + conversation.
const keyCache = new Map();
const keyLoadPromises = new Map();
const identityCache = new Map();
const identityRegistrationPromises = new Map();

const ELGAMAL_STORAGE_PREFIX = 'dispatch_elgamal_private_v1_';

function cryptoRequestConfig(extra = {}) {
  const token = localStorage.getItem('auth_token');

  if (!token) {
    throw new Error('Thiếu JWT khi gọi crypto key API');
  }

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

  if (identityCache.has(cacheKey)) {
    return identityCache.get(cacheKey);
  }

  const manager = new ElGamalKeyManager();
  const savedPrivateKey = localStorage.getItem(
    identityStorageKey(userId)
  );

  if (savedPrivateKey) {
    manager.importPrivateKey(savedPrivateKey);
  } else {
    manager.generateKeyPair();

    // Giữ khóa riêng để giải mã lịch sử khi đăng nhập lại.
    // Chỉ sử dụng cho phiên bản demo môn học.
    localStorage.setItem(
      identityStorageKey(userId),
      manager.exportPrivateKey()
    );
  }

  identityCache.set(cacheKey, manager);
  return manager;
}

/**
 * Đảm bảo tài khoản có cặp khóa ElGamal.
 * Private key nằm tại client.
 * Public key được đăng ký lên backend.
 */
export async function ensureElGamalIdentity(userId) {
  if (!userId) {
    throw new Error('Thiếu userId khi khởi tạo ElGamal identity');
  }

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
        {
          publicKey: publicInfo.y,
          keyVersion: publicInfo.keyVersion
        },
        cryptoRequestConfig()
      );
    } catch (err) {
      if (err.response?.status === 409) {
  throw new Error(
    'ElGamal key trên server khác key của trình duyệt này. ' +
    'Không tạo key mới để tránh mất khả năng giải mã lịch sử.',
    { cause: err }
  );
}

      throw err;
    }

    return manager;
  })();

  identityRegistrationPromises.set(
    identityKey,
    registrationPromise
  );

  try {
    return await registrationPromise;
  } catch (err) {
    identityRegistrationPromises.delete(identityKey);
    throw err;
  }
}

/**
 * Lấy public key ElGamal của một người dùng.
 */
export async function getUserElGamalPublicKey(userId) {
  try {
    const res = await axios.get(
      `${API_BASE}/users/${userId}/elgamal-public-key`,
      cryptoRequestConfig()
    );

    if (!res.data?.publicKey) {
      throw new Error('User chưa có ElGamal public key');
    }

    return res.data;
  } catch (err) {
    if (err.response?.status === 404) {
  throw new Error(
    'Người dùng chưa khởi tạo ElGamal key. ' +
    'Họ cần đăng nhập Dispatch ít nhất một lần.',
    { cause: err }
  );
}

    throw err;
  }
}

/**
 * Lấy AES key đã được mã hóa bằng ElGamal.
 */
async function getWrappedKey(conversationId) {
  const res = await axios.get(
    `${API_BASE}/chat/conversations/${conversationId}/wrapped-key`,
    cryptoRequestConfig()
  );

  if (
    res.status === 204 ||
    !res.data?.c1 ||
    !res.data?.c2
  ) {
    return null;
  }

  return res.data;
}

/**
 * Chuyển conversation cũ sang cơ chế ElGamal wrapped key.
 * Backend chỉ trả raw AES key trong giai đoạn migration.
 */
async function migrateLegacyAesKey(conversationId, manager) {
  const rawRes = await axios.get(
    `${API_BASE}/chat/conversations/${conversationId}/aes-key`,
    cryptoRequestConfig()
  );

  const base64Key = rawRes.data?.key;

  if (!base64Key) {
    throw new Error('Backend không trả về AES migration key');
  }

  const memberRes = await axios.get(
    `${API_BASE}/chat/conversations/${conversationId}/crypto-members`,
    cryptoRequestConfig()
  );

  const wrappedKeys = (memberRes.data || [])
    .filter((member) => member.publicKey)
    .map((member) => {
      const cipher = manager.encryptString(
        base64Key,
        member.publicKey
      );

      return {
        userId: member.userId,
        c1: cipher.c1,
        c2: cipher.c2,
        keyVersion:
          member.keyVersion || ELGAMAL_KEY_VERSION
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
 * Lấy AES CryptoKey của conversation.
 *
 * Ưu tiên:
 * 1. Lấy wrapped key ElGamal.
 * 2. Giải mã tại client.
 * 3. Import thành AES CryptoKey.
 *
 * Với conversation cũ:
 * - Migration raw key.
 * - Wrap bằng ElGamal.
 * - Backend xóa raw key khi đủ điều kiện.
 */
export async function getConversationAESKey(
  conversationId,
  userId
) {
  if (!conversationId) {
    throw new Error('Thiếu conversationId');
  }

  if (!userId) {
    throw new Error('Thiếu userId');
  }

  const cacheKey = `${userId}:${conversationId}`;

  if (keyCache.has(cacheKey)) {
    return keyCache.get(cacheKey);
  }

  if (keyLoadPromises.has(cacheKey)) {
    return keyLoadPromises.get(cacheKey);
  }

  const loadPromise = (async () => {
    const manager = await ensureElGamalIdentity(userId);

    const wrappedKey = await getWrappedKey(conversationId);

    let base64Key;

    if (wrappedKey) {
      if (
        wrappedKey.keyVersion &&
        wrappedKey.keyVersion !== ELGAMAL_KEY_VERSION
      ) {
        throw new Error(
          `Không hỗ trợ ElGamal key version ${wrappedKey.keyVersion}`
        );
      }

      // Giải mã wrapped key bằng private key tại client.
      base64Key = manager.decryptString(wrappedKey);
    } else {
      // Chỉ dành cho conversation chưa migration.
      base64Key = await migrateLegacyAesKey(
        conversationId,
        manager
      );
    }

    // Import AES key thành CryptoKey.
    // Không cần export CryptoKey để thêm thành viên.
    const cryptoKey = await importAESKeyFromBase64(
      base64Key
    );

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
 * Bọc AES key cho thành viên mới.
 *
 * LUỒNG:
 * 1. Đảm bảo người hiện tại có ElGamal identity.
 * 2. Đảm bảo AES key của conversation đã được khởi tạo.
 * 3. Lấy wrapped AES key dành cho người hiện tại.
 * 4. Giải mã wrapped key bằng ElGamal private key.
 * 5. Mã hóa lại bằng public key của thành viên mới.
 *
 * Không sử dụng crypto.subtle.exportKey().
 * Không thay đổi thuộc tính extractable của AES CryptoKey.
 */
export async function wrapConversationKeyForUser(
  conversationId,
  currentUserId,
  targetUserId
) {
  if (!conversationId || !currentUserId || !targetUserId) {
    throw new Error(
      'Thiếu conversationId, currentUserId hoặc targetUserId'
    );
  }

  // 1. Đảm bảo private key ElGamal của người hiện tại.
  const manager = await ensureElGamalIdentity(
    currentUserId
  );

  // 2. Đảm bảo conversation đã có AES key.
  // Nếu là conversation cũ, hàm này sẽ thử migration.
  await getConversationAESKey(
    conversationId,
    currentUserId
  );

  // 3. Lấy wrapped AES key từ backend.
  const wrappedKey = await getWrappedKey(conversationId);

  if (!wrappedKey) {
    throw new Error(
      'Không tìm thấy ElGamal wrapped AES key của tài khoản hiện tại. ' +
      'Không thể thêm thành viên khi khóa hội thoại chưa được phân phối.'
    );
  }

  if (
    wrappedKey.keyVersion &&
    wrappedKey.keyVersion !== ELGAMAL_KEY_VERSION
  ) {
    throw new Error(
      `Không hỗ trợ ElGamal key version ${wrappedKey.keyVersion}`
    );
  }

  // 4. Giải mã wrapped key bằng private key.
  // Kết quả là AES key dưới dạng Base64.
  const base64Key = manager.decryptString(wrappedKey);

  if (!base64Key) {
    throw new Error(
      'Không thể giải mã AES key của conversation'
    );
  }

  // 5. Lấy public key của thành viên mới.
  const target = await getUserElGamalPublicKey(
    targetUserId
  );

  // 6. Bọc lại AES key bằng ElGamal public key của người mới.
  const cipher = manager.encryptString(
    base64Key,
    target.publicKey
  );

  return {
    userId: targetUserId,
    c1: cipher.c1,
    c2: cipher.c2,
    keyVersion:
      target.keyVersion || ELGAMAL_KEY_VERSION
  };
}

/**
 * Xóa AES CryptoKey khỏi RAM.
 * Gọi khi đăng xuất hoặc thay đổi quyền truy cập.
 */
export function clearAESKeyCache() {
  keyCache.clear();
  keyLoadPromises.clear();
}
