
package com.chatapp.backend.security.elgamal;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.security.SecureRandom;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class ElGamalKeyWrapServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final ElGamal.KeyPair keys =
            ElGamal.generateKeyPair("server-v1");

    private final ElGamalKeyWrapService service =
            new ElGamalKeyWrapService(keys, mapper);

    private String createAESKey() {
        byte[] key = new byte[32];
        new SecureRandom().nextBytes(key);
        return Base64.getEncoder().encodeToString(key);
    }

    @Test
    void wrapAndUnwrapSuccessfully() {
        String original = createAESKey();

        String wrapped = service.wrap(original, 1001L);
        String recovered = service.unwrap(wrapped, 1001L);

        assertEquals(original, recovered);
        assertFalse(wrapped.contains(original));
    }

    @Test
    void wrongConversationIdMustFail() {
        String wrapped = service.wrap(createAESKey(), 1001L);

        assertThrows(IllegalStateException.class,
                () -> service.unwrap(wrapped, 2002L));
    }

    @Test
    void wrongPrivateKeyMustFail() {
        var wrongKeys = ElGamal.generateKeyPair("server-v1");

        var wrongService =
                new ElGamalKeyWrapService(wrongKeys, mapper);

        String wrapped = service.wrap(createAESKey(), 1001L);

        assertThrows(IllegalStateException.class,
                () -> wrongService.unwrap(wrapped, 1001L));
    }

    @Test
    void modifiedCiphertextMustFail() {
        String json = service.wrap(createAESKey(), 1001L);

        var wrapped = mapper.readValue(
                json, ElGamal.WrappedAesKey.class);

        byte[] ciphertext =
                Base64.getDecoder().decode(wrapped.ciphertext());

        ciphertext[0] ^= 1;

        var modified = new ElGamal.WrappedAesKey(
                wrapped.version(),
                wrapped.keyId(),
                wrapped.c1(),
                wrapped.salt(),
                wrapped.iv(),
                Base64.getEncoder().encodeToString(ciphertext)
        );

        assertThrows(IllegalStateException.class,
                () -> service.unwrap(
                        mapper.writeValueAsString(modified), 1001L));
    }

    @Test
    void reloadWithSameKeysStillWorks() {
        String original = createAESKey();
        String wrapped = service.wrap(original, 1001L);

        // Giả lập tạo lại service sau khi backend restart
        var restartedService =
                new ElGamalKeyWrapService(keys, new ObjectMapper());

        assertEquals(original,
                restartedService.unwrap(wrapped, 1001L));
    }
}
