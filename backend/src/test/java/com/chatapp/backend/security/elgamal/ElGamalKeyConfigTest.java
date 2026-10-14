package com.chatapp.backend.security.elgamal;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ElGamalKeyConfigTest {

    private final ElGamalKeyConfig config =
            new ElGamalKeyConfig();

    @Test
    void validKeyPair() {
        var keys = ElGamal.generateKeyPair("server-v1");

        var loaded = config.elgamalKeyPair(
                keys.keyId(),
                keys.publicKeyHex(),
                keys.privateKeyHex()
        );

        assertEquals(keys, loaded);
    }

    @Test
    void wrongPrivateKey() {
        var first = ElGamal.generateKeyPair("server-v1");
        var second = ElGamal.generateKeyPair("server-v1");

        assertThrows(IllegalStateException.class, () ->
                config.elgamalKeyPair(
                        first.keyId(),
                        first.publicKeyHex(),
                        second.privateKeyHex()
                )
        );
    }

    @Test
    void missingKeys() {
        assertThrows(IllegalStateException.class, () ->
                config.elgamalKeyPair("server-v1", "", "")
        );
    }
}