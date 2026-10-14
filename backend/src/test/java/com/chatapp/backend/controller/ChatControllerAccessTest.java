package com.chatapp.backend.controller;

import com.chatapp.backend.dto.EditMessageRequest;
import com.chatapp.backend.dto.ForwardMessageRequest;
import com.chatapp.backend.dto.SendMessageRequest;
import com.chatapp.backend.entity.Conversation;
import com.chatapp.backend.entity.ConversationMember;
import com.chatapp.backend.entity.Message;
import com.chatapp.backend.entity.User;
import com.chatapp.backend.repository.ConversationMemberRepository;
import com.chatapp.backend.repository.FriendshipRepository;
import com.chatapp.backend.repository.MessageRepository;
import com.chatapp.backend.security.RequestAccess;
import com.chatapp.backend.service.ChatService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class ChatControllerAccessTest {
    private final ConversationMemberRepository members = mock(ConversationMemberRepository.class);
    private final MessageRepository messages = mock(MessageRepository.class);
    private final ChatService service = mock(ChatService.class);
    private final RequestAccess access = new RequestAccess(members, messages, mock(FriendshipRepository.class));
    private final ChatController controller = new ChatController(service, access);

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private void loginAs(long userId) {
        User user = User.builder().id(userId).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, List.of()));
    }

    private void assertForbidden(Runnable call) {
        ResponseStatusException error = assertThrows(ResponseStatusException.class, call::run);
        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
        verifyNoInteractions(service);
    }

    @Test
    void nonMemberCannotReadMessagesOrMediaOrAesKey() {
        loginAs(1);
        assertForbidden(() -> controller.getMessages(20L));
        assertForbidden(() -> controller.getConversationMedia(20L));
        assertForbidden(() -> controller.getConversationAesKey(20L, User.builder().id(1L).build()));
    }

    @Test
    void senderCannotBeSpoofedAndNonMemberCannotEditOrDelete() {
        loginAs(1);
        SendMessageRequest spoofed = SendMessageRequest.builder()
                .conversationId(20L).senderId(2L).build();
        assertForbidden(() -> controller.sendMessage(spoofed));

        Message foreign = Message.builder().id(30L)
                .conversation(Conversation.builder().id(20L).build()).build();
        when(messages.findById(30L)).thenReturn(Optional.of(foreign));
        EditMessageRequest edit = new EditMessageRequest();
        edit.setMessageId(30L);
        edit.setSenderId(1L);
        assertForbidden(() -> controller.editMessage(edit));
        assertForbidden(() -> controller.deleteMessage(30L, 1L));
    }

    @Test
    void forwardChecksSourceAndEveryDestination() {
        loginAs(1);
        Message source = Message.builder().id(30L)
                .conversation(Conversation.builder().id(10L).build()).build();
        when(messages.findById(30L)).thenReturn(Optional.of(source));
        when(members.findByConversationIdAndUserId(10L, 1L))
                .thenReturn(Optional.of(ConversationMember.builder().build()));
        ForwardMessageRequest request = new ForwardMessageRequest();
        request.setMessageId(30L);
        request.setSenderId(1L);
        request.setTargetConversationIds(List.of(20L));
        assertForbidden(() -> controller.forwardMessage(request));
    }

    @Test
    void groupMemberChangeRequiresCallerIdentity() {
        loginAs(1);
        assertForbidden(() -> controller.addGroupMember(20L, 2L, 3L));
        assertForbidden(() -> controller.addGroupMember(20L, 1L, 3L));
    }
}
