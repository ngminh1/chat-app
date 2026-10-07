package com.chatapp.backend.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * SHA utility cho Dispatch.
 *
 * SHA-256 được dùng để tạo fingerprint cho ENCRYPTED payload
 * (encryptionVersion + IV + ciphertext), không hash plaintext.
 * AES-GCM vẫn là cơ chế xác thực/mã hóa chính; SHA-256 ở đây phục vụ
 * kiểm tra integrity độc lập và yêu cầu thực nghiệm của bài ATTT.
 */
public final class SHA {

    public static final String SHA_1 = "SHA-1";
    public static final String SHA_224 = "SHA-224";
    public static final String SHA_256 = "SHA-256";
    public static final String SHA_384 = "SHA-384";
    public static final String SHA_512 = "SHA-512";

    private SHA() {}

    public static String hashSHA256(String input) {
        return hash(input, SHA_256);
    }

    public static String hash(String input, String algorithm) {
        if (input == null) {
            throw new IllegalArgumentException("Dữ liệu đầu vào không được null");
        }
        try {
            MessageDigest md = MessageDigest.getInstance(algorithm);
            byte[] hashBytes = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return bytesToHex(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalArgumentException("Không hỗ trợ thuật toán: " + algorithm, e);
        }
    }

    public static boolean verifySHA256(String input, String expectedHash) {
        if (input == null || expectedHash == null || !expectedHash.matches("(?i)^[0-9a-f]{64}$")) {
            return false;
        }
        return MessageDigest.isEqual(
                hashSHA256(input).getBytes(StandardCharsets.US_ASCII),
                expectedHash.toLowerCase().getBytes(StandardCharsets.US_ASCII)
        );
    }

    public static String buildEncryptedPayload(String ciphertext, String iv, String encryptionVersion) {
        if (ciphertext == null || ciphertext.isBlank() || iv == null || iv.isBlank()) {
            throw new IllegalArgumentException("Thiếu ciphertext hoặc IV để tính SHA-256");
        }
        String version = (encryptionVersion == null || encryptionVersion.isBlank())
                ? "AES-256-GCM"
                : encryptionVersion;
        return version + "\n" + iv + "\n" + ciphertext;
    }

    public static String hashEncryptedPayload(String ciphertext, String iv, String encryptionVersion) {
        return hashSHA256(buildEncryptedPayload(ciphertext, iv, encryptionVersion));
    }

    public static boolean verifyEncryptedPayload(
            String ciphertext,
            String iv,
            String encryptionVersion,
            String expectedHash) {
        return verifySHA256(buildEncryptedPayload(ciphertext, iv, encryptionVersion), expectedHash);
    }

    public static int[] getHashSize(String algorithm) {
        return switch (algorithm.toUpperCase()) {
            case "SHA-1" -> new int[]{160, 20};
            case "SHA-224" -> new int[]{224, 28};
            case "SHA-256" -> new int[]{256, 32};
            case "SHA-384" -> new int[]{384, 48};
            case "SHA-512" -> new int[]{512, 64};
            default -> new int[]{256, 32};
        };
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b & 0xff));
        }
        return sb.toString();
    }
}
