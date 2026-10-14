package com.chatapp.backend.security.sha256;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

class SHA256Test {
    @Test
    void knownNistEmptyStringVector() {
        assertEquals("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                SHA256.hashText(""));
    }

    @Test
    void knownNistAbcVector() {
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
                SHA256.hashText("abc"));
    }

    @Test
    void hashesUtf8TextAndBytesIdentically() {
        String content = "Tin nhắn tiếng Việt: xin chào";
        assertEquals(SHA256.hashBytes(content.getBytes(StandardCharsets.UTF_8)), SHA256.hashText(content));
        assertEquals(64, SHA256.hashText(content).length());
    }

    @Test
    void detectsChangedTextAndDoesNotModifyInput() {
        byte[] data = {0, 1, 2, (byte) 255};
        byte[] snapshot = data.clone();
        String hash = SHA256.hashBytes(data);
        assertArrayEquals(snapshot, data);
        data[0] ^= 1;
        assertNotEquals(hash, SHA256.hashBytes(data));
    }

    @Test
    void verifiesExactTextAndDetectsTampering() {
        String digest = SHA256.hashText("Dispatch AES-GCM + ElGamal");
        assertTrue(SHA256.verifyText("Dispatch AES-GCM + ElGamal", digest));
        assertFalse(SHA256.verifyText("Dispatch AES-GCM + ElGamaL", digest));
        assertFalse(SHA256.verifyText("Dispatch AES-GCM + ElGamal", "invalid"));
    }

    @Test
    void rejectsNullInput() {
        assertThrows(NullPointerException.class, () -> SHA256.hashText(null));
        assertThrows(NullPointerException.class, () -> SHA256.hashBytes(null));
        assertThrows(NullPointerException.class, () -> SHA256.verifyText(null, "a".repeat(64)));
    }
}
