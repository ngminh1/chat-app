package com.chatapp.backend.service;

import com.chatapp.backend.BackendApplication;
import com.chatapp.backend.controller.ChatController;
import com.chatapp.backend.dto.MessageResponse;
import com.chatapp.backend.dto.SendMessageRequest;
import com.chatapp.backend.entity.*;
import com.chatapp.backend.repository.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Real persistence/API mapping with synthetic test1/test2 accounts in test-only H2. */
@SpringBootTest(classes = BackendApplication.class)
@Transactional
class ChatEncryptionRoundTripTest {
    @Autowired ChatService service;
    @Autowired ChatController controller;
    @Autowired UserRepository users;
    @Autowired ConversationRepository conversations;
    @Autowired ConversationMemberRepository members;
    @Autowired MessageRepository messages;
    @Autowired EntityManager entityManager;
    @Autowired ObjectMapper mapper;

    private User test1;
    private User test2;
    private Conversation conversation;
    private final byte[] originalKey = new byte[32];

    @BeforeEach
    void prepareConversation() {
        new SecureRandom().nextBytes(originalKey);
        test1 = users.save(User.builder().username("test1").displayName("Test One")
                .password("unused-test-fixture").build());
        test2 = users.save(User.builder().username("test2").displayName("Test Two")
                .password("unused-test-fixture").build());
        conversation = conversations.save(Conversation.builder().type(ConversationType.DIRECT)
                .aesKey(Base64.getEncoder().encodeToString(originalKey)).build());
        for (User user : List.of(test1, test2)) {
            members.save(ConversationMember.builder().conversation(conversation).user(user).build());
        }
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    private void login(User user) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, List.of()));
    }

    private SendMessageRequest encrypt(User sender, byte[] key, String plaintext) throws Exception {
        byte[] iv = new byte[12];
        new SecureRandom().nextBytes(iv);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
        return SendMessageRequest.builder().conversationId(conversation.getId()).senderId(sender.getId())
                .messageType(MessageType.TEXT).content("must not reach persistence")
                .ciphertext(Base64.getEncoder().encodeToString(cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8))))
                .iv(Base64.getEncoder().encodeToString(iv)).encryptionVersion("AES-256-GCM").build();
    }

    private String decrypt(MessageResponse message, byte[] key) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"),
                new GCMParameterSpec(128, Base64.getDecoder().decode(message.getIv())));
        return new String(cipher.doFinal(Base64.getDecoder().decode(message.getCiphertext())), StandardCharsets.UTF_8);
    }

    @Test
    void bothMembersDecryptNewMessagesAfterDatabaseAndJsonRoundTrip() throws Exception {
        for (User sender : List.of(test1, test2)) {
            login(sender);
            byte[] key = Base64.getDecoder().decode(controller
                    .getConversationAesKey(conversation.getId(), sender).getBody().getKey());
            var request = encrypt(sender, key, "Xin chào Dispatch");
            var sent = service.sendMessage(request);
            entityManager.flush();
            entityManager.clear();

            var stored = messages.findById(sent.getId()).orElseThrow();
            assertNull(stored.getContent());
            assertEquals(request.getCiphertext(), stored.getCiphertext());
            assertEquals(request.getIv(), stored.getIv());
            assertEquals("AES-256-GCM", stored.getEncryptionVersion());

            for (User reader : List.of(test1, test2)) {
                login(reader);
                byte[] readerKey = Base64.getDecoder().decode(controller
                        .getConversationAesKey(conversation.getId(), reader).getBody().getKey());
                var response = controller.getMessages(conversation.getId()).getBody().stream()
                        .filter(message -> message.getId().equals(sent.getId())).findFirst().orElseThrow();
                var jsonRoundTrip = mapper.readValue(mapper.writeValueAsString(response), MessageResponse.class);
                assertEquals(conversation.getId(), jsonRoundTrip.getConversationId());
                assertEquals(request.getCiphertext(), jsonRoundTrip.getCiphertext());
                assertEquals("Xin chào Dispatch", decrypt(jsonRoundTrip, readerKey));
                assertArrayEquals(originalKey, readerKey);
            }
        }
    }

    @Test
    void historicalCiphertextWithAnotherKeyRemainsUntouched() throws Exception {
        byte[] historicalKey = new byte[32];
        new SecureRandom().nextBytes(historicalKey);
        var request = encrypt(test1, historicalKey, "Synthetic historical fixture");
        var sent = service.sendMessage(request);
        entityManager.flush();
        entityManager.clear();
        login(test2);
        var response = controller.getMessages(conversation.getId()).getBody().getFirst();
        byte[] currentKey = Base64.getDecoder().decode(controller
                .getConversationAesKey(conversation.getId(), test2).getBody().getKey());

        assertThrows(AEADBadTagException.class, () -> decrypt(response, currentKey));
        assertEquals(request.getCiphertext(), messages.findById(sent.getId()).orElseThrow().getCiphertext());
        assertEquals(request.getIv(), response.getIv());
        assertArrayEquals(originalKey, currentKey);
        assertEquals(1, messages.findByConversationIdOrderByIdAsc(conversation.getId()).size());
    }

    @Test
    void missingKeyWithPersistedHistoryDoesNotGenerateReplacement() throws Exception {
        var sent = service.sendMessage(encrypt(test1, originalKey, "Synthetic history"));
        conversation.setAesKey(null);
        conversations.saveAndFlush(conversation);
        entityManager.clear();

        assertThrows(MissingConversationKeyException.class,
                () -> service.getOrCreateConversationAesKey(conversation.getId(), test1.getId()));
        assertNull(conversations.findById(conversation.getId()).orElseThrow().getAesKey());
        assertEquals(sent.getCiphertext(), messages.findById(sent.getId()).orElseThrow().getCiphertext());
    }
}
