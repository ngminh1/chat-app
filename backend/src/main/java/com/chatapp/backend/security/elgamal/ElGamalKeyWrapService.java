package com.chatapp.backend.security.elgamal;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.security.GeneralSecurityException;
import java.util.Arrays;
import java.util.Base64;

@Service
@ConditionalOnProperty(
        name = "dispatch.elgamal.enabled",
        havingValue = "true"
)
public class ElGamalKeyWrapService {

    private final ElGamal.KeyPair keys;
    private final ObjectMapper mapper;

    public ElGamalKeyWrapService(
            ElGamal.KeyPair keys,
            ObjectMapper mapper
    ) {
        this.keys = keys;
        this.mapper = mapper;
    }

    // Bọc khóa AES trước khi lưu database
    public String wrap(String aesKeyBase64, long conversationId) {
        byte[] rawKey = Base64.getDecoder().decode(aesKeyBase64);

        try {
            ElGamal.WrappedAesKey wrapped = ElGamal.wrapKey(
                    rawKey,
                    keys.publicKeyHex(),
                    keys.keyId(),
                    conversationId
            );

            return mapper.writeValueAsString(wrapped);

        } catch (GeneralSecurityException | JacksonException e) {
            throw new IllegalStateException("Không thể bọc khóa AES", e);
        } finally {
            Arrays.fill(rawKey, (byte) 0);
        }
    }

    // Mở khóa AES khi người dùng hợp lệ cần đọc tin
    public String unwrap(String wrappedJson, long conversationId) {
        byte[] rawKey = null;

        try {
            ElGamal.WrappedAesKey wrapped = mapper.readValue(
                    wrappedJson,
                    ElGamal.WrappedAesKey.class
            );

            if (!keys.keyId().equals(wrapped.keyId())) {
                throw new IllegalStateException("Sai ElGamal key ID");
            }

            rawKey = ElGamal.unwrapKey(
                    wrapped,
                    keys.privateKeyHex(),
                    conversationId
            );

            return Base64.getEncoder().encodeToString(rawKey);

        } catch (GeneralSecurityException | JacksonException e) {
            throw new IllegalStateException("Không thể mở khóa AES", e);
        } finally {
            if (rawKey != null) {
                Arrays.fill(rawKey, (byte) 0);
            }
        }
    }
}