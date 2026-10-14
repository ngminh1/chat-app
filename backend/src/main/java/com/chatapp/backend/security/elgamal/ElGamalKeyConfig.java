package com.chatapp.backend.security.elgamal;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;

@Configuration
@ConditionalOnProperty(
        name = "dispatch.elgamal.enabled",
        havingValue = "true"
)
public class ElGamalKeyConfig {

    @Bean
    public ElGamal.KeyPair elgamalKeyPair(
            @Value("${ELGAMAL_KEY_ID:server-v1}") String keyId,
            @Value("${ELGAMAL_PUBLIC_KEY_HEX:}") String publicKey,
            @Value("${ELGAMAL_PRIVATE_KEY_HEX:}") String privateKey
    ) {
        if (publicKey.isBlank() || privateKey.isBlank()) {
            throw new IllegalStateException(
                    "Missing ElGamal server keys"
            );
        }

        byte[] original = new byte[32];
        new SecureRandom().nextBytes(original);

        try {
            var wrapped = ElGamal.wrapKey(
                    original, publicKey, keyId, 1L
            );

            byte[] recovered = ElGamal.unwrapKey(
                    wrapped, privateKey, 1L
            );

            try {
                if (!Arrays.equals(original, recovered)) {
                    throw new IllegalStateException(
                            "ElGamal key pair mismatch"
                    );
                }
            } finally {
                Arrays.fill(recovered, (byte) 0);
            }

            return new ElGamal.KeyPair(
                    keyId, publicKey, privateKey
            );

        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException(
                    "Invalid ElGamal configuration", e
            );
        } finally {
            Arrays.fill(original, (byte) 0);
        }
    }
}