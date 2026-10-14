import axios from 'axios';
import { API_BASE } from '../config/api';
import { importAESKeyFromBase64 } from './crypto';
import { wrapPrivateKey, unwrapPrivateKey } from './keyVault';
import ElGamalKeyManager, { ELGAMAL_KEY_VERSION } from './elgamal';

const keyCache = new Map();
const keyLoadPromises = new Map();
const identityCache = new Map();
const identityRegistrationPromises = new Map();
const verifiedIdentities = new Set();
const ELGAMAL_STORAGE_PREFIX = 'dispatch_elgamal_private_v1_';

function cryptoRequestConfig(extra = {}) {
  const token = localStorage.getItem('auth_token');
  if (!token) throw new Error('Thiếu JWT khi gọi crypto key API');
  return {
    ...extra,
    headers: { ...(extra.headers || {}), Authorization: `Bearer ${token}` }
  };
}

function storageKey(userId) {
  return `${ELGAMAL_STORAGE_PREFIX}${userId}`;
}

function loadLocalManager(userId) {
  const id = String(userId);
  if (identityCache.has(id)) return identityCache.get(id);
  const saved = localStorage.getItem(storageKey(userId));
  if (!saved) return null;
  const manager = new ElGamalKeyManager();
  manager.importPrivateKey(saved);
  identityCache.set(id, manager);
  return manager;
}

async function getServerPublicKey(userId) {
  try {
    const res = await axios.get(
      `${API_BASE}/users/${userId}/elgamal-public-key`,
      cryptoRequestConfig()
    );
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

async function getVaultRecord() {
  const res = await axios.get(
    `${API_BASE}/users/me/elgamal-vault`,
    cryptoRequestConfig()
  );
  return res.data;
}

/**
 * The server is authoritative. Never generate or register a fresh key when
 * a different public key is already bound to the account.
 */
export async function ensureElGamalIdentity(userId) {
  if (!userId) throw new Error('Thiếu userId khi khởi tạo ElGamal identity');
  const id = String(userId);
  if (verifiedIdentities.has(id)) return identityCache.get(id);
  if (identityRegistrationPromises.has(id)) {
    return identityRegistrationPromises.get(id);
  }

  const task = (async () => {
    const remote = await getServerPublicKey(userId);
    let manager = loadLocalManager(userId);

    if (remote?.publicKey) {
      if (!manager) {
        throw new Error(
          'KEY_RECOVERY_REQUIRED: Thiết bị này chưa có private key ElGamal. ' +
          'Mở Cài đặt tài khoản để khôi phục bằng mã dự phòng.'
        );
      }
      if (manager.getPublicKeyInfo().y !== remote.publicKey) {
        throw new Error(
          'KEY_MISMATCH: Private key ở trình duyệt không khớp public key server. ' +
          'Không tự thay khóa. Hãy dùng chức năng khôi phục trong Cài đặt.'
        );
      }
    } else {
      if (!manager) {
        manager = new ElGamalKeyManager();
        manager.generateKeyPair();
        localStorage.setItem(storageKey(userId), manager.exportPrivateKey());
        identityCache.set(id, manager);
      }
      const info = manager.getPublicKeyInfo();
      try {
        await axios.put(
          `${API_BASE}/users/${userId}/elgamal-public-key`,
          { publicKey: info.y, keyVersion: info.keyVersion },
          cryptoRequestConfig()
        );
      } catch (err) {
        if (err.response?.status === 409) {
          throw new Error(
            'KEY_MISMATCH: Public key đã được đăng ký trên thiết bị khác. ' +
            'Mở Cài đặt để khôi phục khóa; không ghi đè public key.',
            { cause: err }
          );
        }
        throw err;
      }
    }

    identityCache.set(id, manager);
    verifiedIdentities.add(id);
    return manager;
  })();
  identityRegistrationPromises.set(id, task);
  try {
    return await task;
  } finally {
    identityRegistrationPromises.delete(id);
  }
}

export async function getElGamalVaultStatus(userId) {
  if (!userId) throw new Error('Thiếu userId');
  const server = await getVaultRecord();
  let localPublicKey = null;
  let localCorrupt = false;
  try {
    localPublicKey = loadLocalManager(userId)?.getPublicKeyInfo().y || null;
  } catch {
    localCorrupt = true;
  }
  const matches = Boolean(server.publicKey && server.publicKey === localPublicKey);
  return {
    hasServerKey: Boolean(server.publicKey),
    hasVault: Boolean(server.wrappedPrivateKey),
    hasLocalKey: Boolean(localPublicKey),
    localCorrupt,
    matches
  };
}

/** Install encrypted backup only after user has saved the recovery code. */
export async function createElGamalVaultBackup(userId, recoveryCode) {
  const manager = await ensureElGamalIdentity(userId);
  const publicKey = manager.getPublicKeyInfo().y;
  const record = await getVaultRecord();
  if (record.publicKey !== publicKey) throw new Error('KEY_MISMATCH');
  if (record.wrappedPrivateKey) throw new Error('VAULT_ALREADY_EXISTS');
  const wrappedPrivateKey = await wrapPrivateKey(
    manager.exportPrivateKey(), recoveryCode, publicKey
  );
  await axios.put(
    `${API_BASE}/users/me/elgamal-vault`,
    { publicKey, wrappedPrivateKey },
    cryptoRequestConfig()
  );
  // Verify the server persisted a decryptable blob for THIS recovery code.
  const stored = await getVaultRecord();
  const restored = await unwrapPrivateKey(stored.wrappedPrivateKey, recoveryCode, publicKey);
  const check = new ElGamalKeyManager();
  check.importPrivateKey(restored);
  if (check.getPublicKeyInfo().y !== publicKey) throw new Error('VAULT_VERIFICATION_FAILED');
  return true;
}

/** Recovery can replace a mismatched local key only after public-key verification. */
export async function recoverElGamalIdentity(userId, recoveryCode) {
  if (!userId) throw new Error('Thiếu userId');
  const record = await getVaultRecord();
  if (!record.publicKey || !record.wrappedPrivateKey) {
    throw new Error('LEGACY_NO_BACKUP: Server không có bản sao lưu. Cần private key gốc.');
  }
  const privateKey = await unwrapPrivateKey(
    record.wrappedPrivateKey, recoveryCode, record.publicKey
  );
  const manager = new ElGamalKeyManager();
  manager.importPrivateKey(privateKey);
  if (manager.getPublicKeyInfo().y !== record.publicKey) {
    throw new Error('KEY_MISMATCH: Bản sao lưu không thuộc tài khoản này');
  }
  // No mutation before all checks have passed.
  localStorage.setItem(storageKey(userId), privateKey);
  clearAESKeyCache();
  identityCache.set(String(userId), manager);
  verifiedIdentities.add(String(userId));
  return true;
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
      throw new Error('Người dùng chưa khởi tạo ElGamal key. Họ cần đăng nhập Dispatch ít nhất một lần.',
        { cause: err });
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

// Legacy-only raw AES-key migration from older conversations.
async function migrateLegacyAesKey(conversationId, manager) {
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
    .filter(member => member.publicKey)
    .map(member => {
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

export async function getConversationAESKey(conversationId, userId) {
  if (!conversationId) throw new Error('Thiếu conversationId');
  if (!userId) throw new Error('Thiếu userId');
  const cacheKey = `${userId}:${conversationId}`;
  if (keyCache.has(cacheKey)) return keyCache.get(cacheKey);
  if (keyLoadPromises.has(cacheKey)) return keyLoadPromises.get(cacheKey);

  const task = (async () => {
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
  keyLoadPromises.set(cacheKey, task);
  try {
    return await task;
  } finally {
    keyLoadPromises.delete(cacheKey);
  }
}

export async function wrapConversationKeyForUser(conversationId, currentUserId, targetUserId) {
  if (!conversationId || !currentUserId || !targetUserId) {
    throw new Error('Thiếu conversationId, currentUserId hoặc targetUserId');
  }
  const manager = await ensureElGamalIdentity(currentUserId);
  await getConversationAESKey(conversationId, currentUserId);
  const wrappedKey = await getWrappedKey(conversationId);
  if (!wrappedKey) {
    throw new Error('Không tìm thấy ElGamal wrapped AES key. Không thể thêm thành viên.');
  }
  if (wrappedKey.keyVersion && wrappedKey.keyVersion !== ELGAMAL_KEY_VERSION) {
    throw new Error(`Không hỗ trợ ElGamal key version ${wrappedKey.keyVersion}`);
  }
  const base64Key = manager.decryptString(wrappedKey);
  if (!base64Key) throw new Error('Không thể giải mã AES key của conversation');
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
  identityCache.clear();
  identityRegistrationPromises.clear();
  verifiedIdentities.clear();
}
