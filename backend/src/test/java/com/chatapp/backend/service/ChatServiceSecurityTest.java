package com.chatapp.backend.service;

import com.chatapp.backend.dto.EditMessageRequest;
import com.chatapp.backend.dto.SendMessageRequest;
import com.chatapp.backend.entity.Conversation;
import com.chatapp.backend.entity.ConversationMember;
import com.chatapp.backend.entity.Message;
import com.chatapp.backend.entity.MessageType;
import com.chatapp.backend.entity.User;
import com.chatapp.backend.repository.ConversationMemberRepository;
import com.chatapp.backend.repository.ConversationRepository;
import com.chatapp.backend.repository.MessageReactionRepository;
import com.chatapp.backend.repository.MessageRepository;
import com.chatapp.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.server.ResponseStatusException;
import com.chatapp.backend.security.elgamal.ElGamal;
import com.chatapp.backend.security.elgamal.ElGamalKeyWrapService;
import tools.jackson.databind.ObjectMapper;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

class ChatServiceSecurityTest {
    private final ConversationRepository conversations = mock(ConversationRepository.class);
    private final ConversationMemberRepository members = mock(ConversationMemberRepository.class);
    private final MessageRepository messages = mock(MessageRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ChatService service = new ChatService(conversations, members, messages,
            mock(MessageReactionRepository.class), users, mock(SimpMessagingTemplate.class));

    private final Conversation conversation = Conversation.builder().id(10L).build();
    private final User sender = User.builder().id(1L).displayName("Alice").build();

    private SendMessageRequest encryptedRequest() {
        return SendMessageRequest.builder().conversationId(10L).senderId(1L)
                .messageType(MessageType.TEXT).content("must not be stored")
                .ciphertext(Base64.getEncoder().encodeToString(new byte[16]))
                .iv(Base64.getEncoder().encodeToString(new byte[12]))
                .encryptionVersion("AES-256-GCM").build();
    }

    private void prepareSender() {
        ConversationMember member = ConversationMember.builder()
                .conversation(conversation).user(sender).build();
        when(conversations.findById(10L)).thenReturn(Optional.of(conversation));
        when(members.findByConversationIdAndUserId(10L, 1L)).thenReturn(Optional.of(member));
        when(members.findByConversationId(10L)).thenReturn(List.of(member));
        when(users.findById(1L)).thenReturn(Optional.of(sender));
        when(messages.save(any(Message.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void encryptedTextStoresCiphertextWithoutPlaintext() {
        prepareSender();
        var result = service.sendMessage(encryptedRequest());
        assertNull(result.getContent());
        assertNotNull(result.getCiphertext());
        verify(messages).save(argThat(message -> message.getContent() == null
                && message.getCiphertext() != null && message.getIv() != null));
    }

    @Test
    void plaintextAndMalformedAesRequestsAreRejected() {
        prepareSender();
        SendMessageRequest plaintext = SendMessageRequest.builder()
                .conversationId(10L).senderId(1L).messageType(MessageType.TEXT)
                .content("plaintext").build();
        assertEquals(HttpStatus.BAD_REQUEST,
                assertThrows(ResponseStatusException.class, () -> service.sendMessage(plaintext)).getStatusCode());
        SendMessageRequest malformed = encryptedRequest();
        malformed.setIv("bad");
        assertEquals(HttpStatus.BAD_REQUEST,
                assertThrows(ResponseStatusException.class, () -> service.sendMessage(malformed)).getStatusCode());
        verify(messages, never()).save(any(Message.class));
    }

    @Test
    void editRequiresEncryptedTextAndOwner() {
        Message message = Message.builder().id(30L).conversation(conversation)
                .sender(sender).messageType(MessageType.TEXT).build();
        when(messages.findById(30L)).thenReturn(Optional.of(message));
        EditMessageRequest request = new EditMessageRequest();
        request.setMessageId(30L);
        request.setSenderId(1L);
        request.setContent("plaintext edit");
        assertEquals(HttpStatus.BAD_REQUEST,
                assertThrows(ResponseStatusException.class, () -> service.editMessage(request)).getStatusCode());
        request.setSenderId(2L);
        assertThrows(RuntimeException.class, () -> service.editMessage(request));
        verify(messages, never()).save(any(Message.class));
    }

    @Test
    void missingLegacyAesKeyIsNotReplacedForEncryptedHistory() {
        when(conversations.findById(10L)).thenReturn(Optional.of(conversation));
        when(members.findByConversationIdAndUserId(10L, 1L))
                .thenReturn(Optional.of(ConversationMember.builder().build()));
        when(messages.existsByConversationIdAndCiphertextIsNotNull(10L)).thenReturn(true);
        assertThrows(MissingConversationKeyException.class, () -> service.getOrCreateConversationAesKey(10L, 1L));
        verify(conversations, never()).save(any(Conversation.class));
    }

    @Test
    void deleteClearsEncryptedPayload() {
        Message message = Message.builder().id(30L).conversation(conversation)
                .sender(sender).messageType(MessageType.TEXT)
                .ciphertext("cipher").iv("iv").encryptionVersion("AES-256-GCM").build();
        when(messages.findById(30L)).thenReturn(Optional.of(message));
        when(messages.save(any(Message.class))).thenAnswer(invocation -> invocation.getArgument(0));
        var response = service.deleteMessage(30L, 1L);
        assertTrue(response.getIsDeleted());
        assertNull(response.getCiphertext());
        assertNull(response.getIv());
    }

    @Test
    void attachmentMustBelongToConversationBeingSent() {
        prepareSender();
        SendMessageRequest request = SendMessageRequest.builder()
                .conversationId(10L).senderId(1L).messageType(MessageType.IMAGE)
                .mediaUrl("/api/media/files/attachment-20-stolen.png").build();
        assertEquals(HttpStatus.BAD_REQUEST,
                assertThrows(ResponseStatusException.class, () -> service.sendMessage(request)).getStatusCode());
        verify(messages, never()).save(any(Message.class));
    }
    
private void prepareKeyAccess() {
    when(conversations.findById(10L))
            .thenReturn(Optional.of(conversation));

    when(members.findByConversationIdAndUserId(10L, 1L))
            .thenReturn(Optional.of(
                    ConversationMember.builder().build()
            ));
}

private ElGamalKeyWrapService enableElGamal() {
    var keys = ElGamal.generateKeyPair("server-v1");
    var wrapper = new ElGamalKeyWrapService(
            keys, new ObjectMapper()
    );
    service.setElGamalKeyWrapService(wrapper);
    return wrapper;
}

@Test
void existingAesKeyIsWrappedWithoutChangingIt() {
    prepareKeyAccess();
    var wrapper = enableElGamal();

    String original = Base64.getEncoder()
            .encodeToString(new byte[32]);

    conversation.setAesKey(original);

    var response = service.getOrCreateConversationAesKey(10L, 1L);

    assertEquals(original, response.getKey());
    assertNotNull(conversation.getWrappedAesKey());
    assertEquals(original, wrapper.unwrap(
            conversation.getWrappedAesKey(), 10L
    ));

    verify(conversations).save(conversation);
}

@Test
void wrappedKeyWorksWithoutRawKey() {
    prepareKeyAccess();
    var wrapper = enableElGamal();

    String original = Base64.getEncoder()
            .encodeToString(new byte[32]);

    conversation.setWrappedAesKey(wrapper.wrap(original, 10L));
    conversation.setAesKey(null);

    var response = service.getOrCreateConversationAesKey(10L, 1L);

    assertEquals(original, response.getKey());
    verify(conversations, never()).save(any());
}

@Test
void corruptedWrappedKeyMustNotUseRawFallback() {
    prepareKeyAccess();
    enableElGamal();

    conversation.setAesKey(
            Base64.getEncoder().encodeToString(new byte[32])
    );
    conversation.setWrappedAesKey("{invalid-json");

    assertThrows(RuntimeException.class, () ->
            service.getOrCreateConversationAesKey(10L, 1L)
    );

    verify(conversations, never()).save(any());
}

@Test
void mismatchedAesKeysMustFail() {
    prepareKeyAccess();
    var wrapper = enableElGamal();

    byte[] first = new byte[32];
    byte[] second = new byte[32];
    second[0] = 1;

    conversation.setAesKey(
            Base64.getEncoder().encodeToString(first)
    );

    conversation.setWrappedAesKey(wrapper.wrap(
            Base64.getEncoder().encodeToString(second), 10L
    ));

    assertThrows(IllegalStateException.class, () ->
            service.getOrCreateConversationAesKey(10L, 1L)
    );

    verify(conversations, never()).save(any());
}

}
