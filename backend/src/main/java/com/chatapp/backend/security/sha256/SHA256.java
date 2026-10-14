package com.chatapp.backend.security.sha256;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Objects;

/**
 * SHA-256 digest utility for integrity demonstrations.
 * Uses Java's standard cryptographic implementation; this is not a handwritten SHA-256 implementation.
 * A plain SHA-256 digest is not an authentication tag and must not replace AES-GCM authentication.
 */
public final class SHA256 {
    private static final char[] HEX = "0123456789abcdef".toCharArray();

    private SHA256() {
    }

    public static String hashText(String text) {
        Objects.requireNonNull(text, "text");
        return hashBytes(text.getBytes(StandardCharsets.UTF_8));
    }

    public static String hashBytes(byte[] data) {
        Objects.requireNonNull(data, "data");
        final byte[] digest;
        try {
            digest = MessageDigest.getInstance("SHA-256").digest(data);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
        char[] hex = new char[digest.length * 2];
        for (int i = 0; i < digest.length; i++) {
            int b = digest[i] & 0xff;
            hex[2 * i] = HEX[b >>> 4];
            hex[2 * i + 1] = HEX[b & 0x0f];
        }
        return new String(hex);
    }

    /**
     * Hash an input stream incrementally, avoiding loading uploaded files into memory.
     * The caller owns and closes the input stream.
     */
    public static String hashStream(InputStream input) throws IOException {
        Objects.requireNonNull(input, "input");
        final MessageDigest md;
        try {
            md = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }

        byte[] buffer = new byte[8192];
        int count;
        while ((count = input.read(buffer)) != -1) {
            md.update(buffer, 0, count);
        }
        byte[] digest = md.digest();
        char[] hex = new char[digest.length * 2];
        for (int i = 0; i < digest.length; i++) {
            int b = digest[i] & 0xff;
            hex[2 * i] = HEX[b >>> 4];
            hex[2 * i + 1] = HEX[b & 0x0f];
        }
        return new String(hex);
    }

    /** Verify a known SHA-256 hex digest, using constant-time byte comparison. */
    public static boolean verifyText(String text, String expectedHex) {
        Objects.requireNonNull(text, "text");
        Objects.requireNonNull(expectedHex, "expectedHex");
        if (!expectedHex.matches("(?i)[0-9a-f]{64}")) {
            return false;
        }
        byte[] expected = java.util.HexFormat.of().parseHex(expectedHex.toLowerCase(java.util.Locale.ROOT));
        byte[] actual = java.util.HexFormat.of().parseHex(hashText(text));
        return MessageDigest.isEqual(actual, expected);
    }
}
