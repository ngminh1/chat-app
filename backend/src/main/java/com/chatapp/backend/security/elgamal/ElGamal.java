package com.chatapp.backend.security.elgamal;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

/**
 * ElGamal hybrid key wrapping for Dispatch (Java 21, no external dependencies).
 *
 * Math: y = g^x mod p; c1 = g^r mod p; shared secret = y^r = c1^x mod p.
 * HKDF-SHA256(shared secret) derives a one-time AES-256-GCM wrapping key.
 * We wrap ONLY the 32-byte AES conversation key, not chat messages.
 *
 * IMPORTANT: This service does NOT implement end-to-end encryption. The server
 * holds the private key and is able to recover the conversation AES key.
 * Do not use in production before safe private-key storage / backup / rotation
 * and atomic migration from the existing conversations.aes_key column.
 */
public final class ElGamal {
    private ElGamal() {}

    // RFC 3526, group 15: standardized 3072-bit safe prime (p), g = 2.
    // g generates the prime-order subgroup q = (p - 1)/2.
    private static final BigInteger P = new BigInteger("""
        FFFFFFFF FFFFFFFF C90FDAA2 2168C234 C4C6628B 80DC1CD1
        29024E08 8A67CC74 020BBEA6 3B139B22 514A0879 8E3404DD
        EF9519B3 CD3A431B 302B0A6D F25F1437 4FE1356D 6D51C245
        E485B576 625E7EC6 F44C42E9 A637ED6B 0BFF5CB6 F406B7ED
        EE386BFB 5A899FA5 AE9F2411 7C4B1FE6 49286651 ECE45B3D
        C2007CB8 A163BF05 98DA4836 1C55D39A 69163FA8 FD24CF5F
        83655D23 DCA3AD96 1C62F356 208552BB 9ED52907 7096966D
        670C354E 4ABC9804 F1746C08 CA18217C 32905E46 2E36CE3B
        E39E772C 180E8603 9B2783A2 EC07A28F B5C55DF0 6F4C52C9
        DE2BCBF6 95581718 3995497C EA956AE5 15D22618 98FA0510
        15728E5A 8AAAC42D AD33170D 04507A33 A85521AB DF1CBA64
        ECFB8504 58DBEF0A 8AEA7157 5D060C7D B3970F85 A6E1E4C7
        ABF5AE8C DB0933D7 1E8C94E0 4A25619D CEE3D226 1AD2EE6B
        F12FFA06 D98A0864 D8760273 3EC86A64 521F2B18 177B200C
        BBE11757 7A615D6C 770988C0 BAD946E2 08E24FA0 74E5AB31
        43DB5BFC E0FD108E 4B82D120 A93AD2CA FFFFFFFF FFFFFFFF
        """.replaceAll("\\s", ""), 16);
    private static final BigInteger Q = P.subtract(BigInteger.ONE).shiftRight(1);
    private static final BigInteger G = BigInteger.TWO;
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int GROUP_BYTES = 384;
    private static final int AES_KEY_BYTES = 32;
    private static final int SALT_BYTES = 16;
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final int VERSION = 1;

    /** keyId is a non-secret stable identifier; privateKeyHex must NEVER be committed/logged. */
    public record KeyPair(String keyId, String publicKeyHex, String privateKeyHex) {}

    /** Encoded data to persist in the DB after safe migration. */
    public record WrappedAesKey(
            int version, String keyId, String c1, String salt, String iv, String ciphertext) {}

    /** Generate once, then securely persist privateKeyHex outside database and Git. */
    // HOC ELGAMAL: Sinh khoa rieng x, khoa cong khai y = g^x mod p (nhom 3072 bit).
    public static KeyPair generateKeyPair(String keyId) {
        validateKeyId(keyId);
        BigInteger x = randomExponent();
        BigInteger y = G.modPow(x, P);
        return new KeyPair(keyId, y.toString(16), x.toString(16));
    }

    /** Wrap an existing AES-256 conversation key for storage; never change its bytes. */
    // HOC ELGAMAL HYBRID: r -> c1=g^r; shared=y^r; HKDF-SHA256 -> khoa boc;
    // AES-GCM boc 32 byte AES key, AAD rang buoc keyId va conversationId.
    public static WrappedAesKey wrapKey(
            byte[] aesKey, String publicKeyHex, String keyId, long conversationId)
            throws GeneralSecurityException {
        validateContext(keyId, conversationId);
        if (aesKey == null || aesKey.length != AES_KEY_BYTES) {
            throw new IllegalArgumentException("Conversation AES key must be 32 bytes");
        }
        BigInteger y = parseGroupElement(publicKeyHex); // Reject invalid subgroup elements.
        BigInteger r = randomExponent();
        BigInteger c1 = G.modPow(r, P);
        BigInteger secret = y.modPow(r, P);

        byte[] salt = randomBytes(SALT_BYTES);
        byte[] iv = randomBytes(IV_BYTES);
        byte[] wrapKey = deriveWrappingKey(secret, salt, context(keyId, conversationId));
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(wrapKey, "AES"),
                    new GCMParameterSpec(TAG_BITS, iv));
            cipher.updateAAD(aad(keyId, conversationId, c1));
            byte[] ciphertext = cipher.doFinal(aesKey);
            return new WrappedAesKey(VERSION, keyId, c1.toString(16),
                    base64(salt), base64(iv), base64(ciphertext));
        } finally {
            Arrays.fill(wrapKey, (byte) 0);
        }
    }

    /** Unwrap only after JWT and conversation membership have been checked by ChatController. */
    // HOC ELGAMAL: shared=c1^x; HKDF sinh lai khoa boc; AES-GCM decrypt + xac thuc tag.
    public static byte[] unwrapKey(
            WrappedAesKey wrapped, String privateKeyHex, long conversationId)
            throws GeneralSecurityException {
        if (wrapped == null || wrapped.version() != VERSION) {
            throw new IllegalArgumentException("Unsupported wrapped-key version");
        }
        validateContext(wrapped.keyId(), conversationId);
        BigInteger x = parsePrivateExponent(privateKeyHex);
        BigInteger c1 = parseGroupElement(wrapped.c1());
        byte[] salt = decodeBase64(wrapped.salt(), SALT_BYTES);
        byte[] iv = decodeBase64(wrapped.iv(), IV_BYTES);
        byte[] ciphertext = decodeBase64(wrapped.ciphertext(), AES_KEY_BYTES + TAG_BITS / 8);

        BigInteger secret = c1.modPow(x, P);
        byte[] wrapKey = deriveWrappingKey(secret, salt, context(wrapped.keyId(), conversationId));
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(wrapKey, "AES"),
                    new GCMParameterSpec(TAG_BITS, iv));
            cipher.updateAAD(aad(wrapped.keyId(), conversationId, c1));
            return cipher.doFinal(ciphertext); // Fails closed on altered ciphertext, AAD or key.
        } finally {
            Arrays.fill(wrapKey, (byte) 0);
        }
    }

    private static BigInteger randomExponent() {
        BigInteger n;
        do {
            n = new BigInteger(Q.bitLength(), RANDOM);
        } while (n.compareTo(BigInteger.TWO) < 0 || n.compareTo(Q) >= 0);
        return n;
    }

    private static BigInteger parseGroupElement(String hex) {
        BigInteger v = parseHex(hex);
        if (v.compareTo(BigInteger.TWO) < 0 || v.compareTo(P.subtract(BigInteger.TWO)) > 0
                || !v.modPow(Q, P).equals(BigInteger.ONE)) {
            throw new IllegalArgumentException("Invalid ElGamal group element");
        }
        return v;
    }

    private static BigInteger parsePrivateExponent(String hex) {
        BigInteger x = parseHex(hex);
        if (x.compareTo(BigInteger.TWO) < 0 || x.compareTo(Q) >= 0) {
            throw new IllegalArgumentException("Invalid ElGamal private exponent");
        }
        return x;
    }

    private static BigInteger parseHex(String hex) {
        if (hex == null || hex.isBlank() || hex.length() > GROUP_BYTES * 2
                || !hex.matches("[0-9a-fA-F]+")) {
            throw new IllegalArgumentException("Invalid hex encoding");
        }
        return new BigInteger(hex, 16);
    }

    private static byte[] deriveWrappingKey(BigInteger secret, byte[] salt, byte[] info)
            throws GeneralSecurityException {
        // HKDF-Extract and single-block HKDF-Expand, SHA-256 (RFC 5869).
        byte[] secretBytes = toFixedLength(secret);
        byte[] prk = null;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(salt, "HmacSHA256"));
            prk = mac.doFinal(secretBytes);
            mac.init(new SecretKeySpec(prk, "HmacSHA256"));
            mac.update(info);
            mac.update((byte) 0x01);
            return mac.doFinal(); // 32-byte key for wrapping with AES-256-GCM.
        } finally {
            Arrays.fill(secretBytes, (byte) 0);
            if (prk != null) Arrays.fill(prk, (byte) 0);
        }
    }

    private static byte[] toFixedLength(BigInteger n) {
        byte[] bytes = n.toByteArray();
        if (bytes.length > GROUP_BYTES + 1) throw new IllegalArgumentException("Out of range");
        byte[] result = new byte[GROUP_BYTES];
        int offset = (bytes.length == GROUP_BYTES + 1 && bytes[0] == 0) ? 1 : 0;
        int actualLength = bytes.length - offset;
        if (actualLength > GROUP_BYTES) throw new IllegalArgumentException("Out of range");
        System.arraycopy(bytes, offset, result, GROUP_BYTES - actualLength, actualLength);
        return result;
    }

    private static void validateKeyId(String keyId) {
        if (keyId == null || !keyId.matches("[A-Za-z0-9._-]{1,64}")) {
            throw new IllegalArgumentException("Invalid keyId");
        }
    }

    private static void validateContext(String keyId, long conversationId) {
        validateKeyId(keyId);
        if (conversationId <= 0) throw new IllegalArgumentException("Invalid conversationId");
    }

    private static byte[] context(String keyId, long conversationId) {
        return ("Dispatch|ElGamal-wrap|v1|" + keyId + "|conv:" + conversationId)
                .getBytes(StandardCharsets.UTF_8);
    }

    private static byte[] aad(String keyId, long conversationId, BigInteger c1) {
        return ("Dispatch|ElGamal-AAD|v1|" + keyId + "|conv:" + conversationId
                + "|c1:" + c1.toString(16)).getBytes(StandardCharsets.UTF_8);
    }

    private static byte[] randomBytes(int count) {
        byte[] result = new byte[count];
        RANDOM.nextBytes(result);
        return result;
    }

    private static String base64(byte[] input) {
        return Base64.getEncoder().encodeToString(input);
    }

    private static byte[] decodeBase64(String encoded, int expectedSize) {
        if (encoded == null || encoded.length() > 8192) {
            throw new IllegalArgumentException("Invalid Base64 encoding");
        }
        byte[] decoded = Base64.getDecoder().decode(encoded);
        if (decoded.length != expectedSize) throw new IllegalArgumentException("Invalid encoded length");
        return decoded;
    }
}
