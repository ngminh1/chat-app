package com.chatapp.backend.security.elgamal;

import org.junit.jupiter.api.Test;

import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class ElGamalTest {
    private static final SecureRandom RANDOM = new SecureRandom();

    @Test
    void wrapsAndUnwrapsExactOriginalAesKey() throws GeneralSecurityException {
        ElGamal.KeyPair keys = ElGamal.generateKeyPair("server-v1");
        byte[] original = new byte[32];
        RANDOM.nextBytes(original);
        var wrapped = ElGamal.wrapKey(original, keys.publicKeyHex(), keys.keyId(), 1001L);
        byte[] unwrapped = ElGamal.unwrapKey(wrapped, keys.privateKeyHex(), 1001L);
        assertArrayEquals(original, unwrapped);
        assertEquals(1, wrapped.version());
        assertEquals(12, Base64.getDecoder().decode(wrapped.iv()).length);
        assertEquals(48, Base64.getDecoder().decode(wrapped.ciphertext()).length);
    }

    @Test
    void randomEncapsulationProducesDifferentCiphertext() throws GeneralSecurityException {
        var keys = ElGamal.generateKeyPair("server-v1");
        byte[] aesKey = new byte[32];
        RANDOM.nextBytes(aesKey);
        var first = ElGamal.wrapKey(aesKey, keys.publicKeyHex(), keys.keyId(), 7L);
        var second = ElGamal.wrapKey(aesKey, keys.publicKeyHex(), keys.keyId(), 7L);
        assertNotEquals(first.c1(), second.c1());
        assertNotEquals(first.ciphertext(), second.ciphertext());
        assertArrayEquals(aesKey, ElGamal.unwrapKey(first, keys.privateKeyHex(), 7L));
        assertArrayEquals(aesKey, ElGamal.unwrapKey(second, keys.privateKeyHex(), 7L));
    }

    @Test
    void failsIfConversationIdChanges() throws GeneralSecurityException {
        var keys = ElGamal.generateKeyPair("server-v1");
        byte[] aesKey = new byte[32];
        var wrapped = ElGamal.wrapKey(aesKey, keys.publicKeyHex(), keys.keyId(), 7L);
        assertThrows(GeneralSecurityException.class,
                () -> ElGamal.unwrapKey(wrapped, keys.privateKeyHex(), 8L));
    }

    @Test
    void failsOnModifiedCiphertext() throws GeneralSecurityException {
        var keys = ElGamal.generateKeyPair("server-v1");
        var wrapped = ElGamal.wrapKey(new byte[32], keys.publicKeyHex(), keys.keyId(), 7L);
        byte[] altered = Base64.getDecoder().decode(wrapped.ciphertext());
        altered[0] ^= 1;
        var tampered = new ElGamal.WrappedAesKey(
                wrapped.version(), wrapped.keyId(), wrapped.c1(), wrapped.salt(),
                wrapped.iv(), Base64.getEncoder().encodeToString(altered));
        assertThrows(GeneralSecurityException.class,
                () -> ElGamal.unwrapKey(tampered, keys.privateKeyHex(), 7L));
    }

    @Test
    void failsWithWrongPrivateKey() throws GeneralSecurityException {
        var a = ElGamal.generateKeyPair("server-v1");
        var b = ElGamal.generateKeyPair("server-v2");
        var wrapped = ElGamal.wrapKey(new byte[32], a.publicKeyHex(), a.keyId(), 7L);
        assertThrows(GeneralSecurityException.class,
                () -> ElGamal.unwrapKey(wrapped, b.privateKeyHex(), 7L));
    }

    @Test
    void rejectsBadAesLengthAndMalformedGroupInput() {
        var keys = ElGamal.generateKeyPair("server-v1");
        assertThrows(IllegalArgumentException.class,
                () -> ElGamal.wrapKey(new byte[16], keys.publicKeyHex(), keys.keyId(), 7L));
        assertThrows(IllegalArgumentException.class,
                () -> ElGamal.wrapKey(new byte[32], "1", keys.keyId(), 7L));
    }
}
