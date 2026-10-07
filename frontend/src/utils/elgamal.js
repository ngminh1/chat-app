/**
 * ElGamal Key Manager for Dispatch.
 *
 * Adapted from the submitted ElGamal module, but changed for real integration:
 * - BigInt end-to-end (no Number truncation)
 * - Web Crypto CSPRNG instead of Math.random()
 * - RFC 3526 MODP Group 14 (2048-bit prime, generator 2)
 * - encrypt/decrypt one short UTF-8 payload (used only to wrap AES-256 keys)
 * - ES module export for React/Vite
 *
 * IMPORTANT: ElGamal is used to wrap the conversation AES key only.
 * Chat messages themselves remain AES-256-GCM encrypted.
 */

export const ELGAMAL_KEY_VERSION = 1;
export const ELGAMAL_ALGORITHM = 'ELGAMAL-RFC3526-GROUP14';

// RFC 3526, MODP Group 14 (2048-bit), generator g = 2.
const P_HEX =
  'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1' +
  '29024E088A67CC74020BBEA63B139B22514A08798E3404DD' +
  'EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245' +
  'E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED' +
  'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3D' +
  'C2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F' +
  '83655D23DCA3AD961C62F356208552BB9ED529077096966D' +
  '670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B' +
  'E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9' +
  'DE2BCBF6955817183995497CEA956AE515D2261898FA0510' +
  '15728E5A8AACAA68FFFFFFFFFFFFFFFF';

export const ELGAMAL_P = BigInt(`0x${P_HEX}`);
export const ELGAMAL_G = 2n;

function modPow(base, exp, mod) {
  let result = 1n;
  let b = BigInt(base) % mod;
  let e = BigInt(exp);

  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }

  return result;
}

function modInverse(a, mod) {
  let oldR = BigInt(a);
  let r = BigInt(mod);
  let oldS = 1n;
  let s = 0n;

  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }

  if (oldR !== 1n) throw new Error('Không tồn tại nghịch đảo modulo');
  return ((oldS % mod) + mod) % mod;
}

function randomBigIntBelow(maxExclusive) {
  if (maxExclusive <= 0n) throw new Error('Khoảng random không hợp lệ');

  const bitLength = maxExclusive.toString(2).length;
  const byteLength = Math.ceil(bitLength / 8);
  const excessBits = byteLength * 8 - bitLength;

  while (true) {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);

    if (excessBits > 0) {
      bytes[0] &= 0xff >>> excessBits;
    }

    let value = 0n;
    for (const byte of bytes) {
      value = (value << 8n) | BigInt(byte);
    }

    if (value < maxExclusive) return value;
  }
}

function randomPrivateExponent() {
  // Uniform in [2, p - 2].
  return 2n + randomBigIntBelow(ELGAMAL_P - 3n);
}

function bytesToBigInt(bytes) {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

function bigIntToBytes(value) {
  let n = BigInt(value);
  if (n < 0n) throw new Error('Không thể chuyển BigInt âm thành bytes');
  if (n === 0n) return new Uint8Array([0]);

  const bytes = [];
  while (n > 0n) {
    bytes.push(Number(n & 0xffn));
    n >>= 8n;
  }
  bytes.reverse();
  return new Uint8Array(bytes);
}

function stringToMessageInteger(text) {
  const payload = new TextEncoder().encode(text ?? '');

  // Sentinel 0x01 preserves leading zero bytes when converting back from BigInt.
  const withSentinel = new Uint8Array(payload.length + 1);
  withSentinel[0] = 1;
  withSentinel.set(payload, 1);

  const m = bytesToBigInt(withSentinel);
  if (m >= ELGAMAL_P) {
    throw new Error('Payload quá lớn cho ElGamal group hiện tại');
  }
  return m;
}

function messageIntegerToString(value) {
  const bytes = bigIntToBytes(value);
  if (bytes.length === 0 || bytes[0] !== 1) {
    throw new Error('ElGamal payload không hợp lệ');
  }
  return new TextDecoder().decode(bytes.slice(1));
}

export default class ElGamalKeyManager {
  #privateKey = null;
  #publicKey = null;

  generateKeyPair() {
    this.#privateKey = randomPrivateExponent();
    this.#publicKey = modPow(ELGAMAL_G, this.#privateKey, ELGAMAL_P);
    return this.getPublicKeyInfo();
  }

  importPrivateKey(privateKey) {
    const x = BigInt(privateKey);
    if (x < 2n || x > ELGAMAL_P - 2n) {
      throw new Error('ElGamal private key không hợp lệ');
    }
    this.#privateKey = x;
    this.#publicKey = modPow(ELGAMAL_G, x, ELGAMAL_P);
    return this.getPublicKeyInfo();
  }

  exportPrivateKey() {
    if (this.#privateKey === null) throw new Error('Chưa khởi tạo ElGamal private key');
    return this.#privateKey.toString(10);
  }

  getPublicKeyInfo() {
    if (this.#publicKey === null) throw new Error('Chưa khởi tạo cặp khóa ElGamal');
    return {
      algorithm: ELGAMAL_ALGORITHM,
      keyVersion: ELGAMAL_KEY_VERSION,
      y: this.#publicKey.toString(10)
    };
  }

  encryptString(message, recipientPublicKey) {
    const y = BigInt(recipientPublicKey);
    if (y <= 1n || y >= ELGAMAL_P) {
      throw new Error('ElGamal public key người nhận không hợp lệ');
    }

    const m = stringToMessageInteger(message);
    const k = randomPrivateExponent();
    const c1 = modPow(ELGAMAL_G, k, ELGAMAL_P);
    const sharedSecret = modPow(y, k, ELGAMAL_P);
    const c2 = (m * sharedSecret) % ELGAMAL_P;

    return {
      c1: c1.toString(10),
      c2: c2.toString(10),
      keyVersion: ELGAMAL_KEY_VERSION,
      algorithm: ELGAMAL_ALGORITHM
    };
  }

  decryptString(ciphertext) {
    if (this.#privateKey === null) {
      throw new Error('Không có ElGamal private key để giải mã');
    }
    if (!ciphertext?.c1 || !ciphertext?.c2) {
      throw new Error('ElGamal ciphertext thiếu c1 hoặc c2');
    }

    const c1 = BigInt(ciphertext.c1);
    const c2 = BigInt(ciphertext.c2);
    if (c1 <= 0n || c1 >= ELGAMAL_P || c2 < 0n || c2 >= ELGAMAL_P) {
      throw new Error('ElGamal ciphertext không hợp lệ');
    }

    const sharedSecret = modPow(c1, this.#privateKey, ELGAMAL_P);
    const sharedSecretInverse = modInverse(sharedSecret, ELGAMAL_P);
    const messageInteger = (c2 * sharedSecretInverse) % ELGAMAL_P;

    return messageIntegerToString(messageInteger);
  }
}
