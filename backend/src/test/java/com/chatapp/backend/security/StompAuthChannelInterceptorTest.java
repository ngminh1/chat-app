package com.chatapp.backend.security;

import com.chatapp.backend.entity.ConversationMember;
import com.chatapp.backend.entity.User;
import com.chatapp.backend.repository.ConversationMemberRepository;
import com.chatapp.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class StompAuthChannelInterceptorTest {
    private final JwtTokenProvider tokens = mock(JwtTokenProvider.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ConversationMemberRepository members = mock(ConversationMemberRepository.class);
    private final StompAuthChannelInterceptor interceptor =
            new StompAuthChannelInterceptor(tokens, users, members);

    private Message<byte[]> frame(StompCommand command, Principal user, String destination, String authorization) {
        StompHeaderAccessor headers = StompHeaderAccessor.create(command);
        headers.setSessionId("session-1");
        headers.setSessionAttributes(new HashMap<>());
        headers.setUser(user);
        if (destination != null) headers.setDestination(destination);
        if (authorization != null) headers.addNativeHeader("Authorization", authorization);
        headers.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders());
    }

    private void assertForbidden(Message<byte[]> message) {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> interceptor.preSend(message, null));
        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
    }

    @Test
    void connectRequiresValidJwt() {
        assertForbidden(frame(StompCommand.CONNECT, null, null, null));
        assertForbidden(frame(StompCommand.CONNECT, null, null, "Bearer invalid"));
        when(tokens.validateToken("good")).thenReturn(true);
        when(tokens.getUserIdFromJWT("good")).thenReturn(1L);
        when(users.findById(1L)).thenReturn(Optional.of(User.builder().id(1L).build()));
        assertDoesNotThrow(() -> interceptor.preSend(
                frame(StompCommand.CONNECT, null, null, "Bearer good"), null));
    }

    @Test
    void subscribeRequiresOwnUserTopicOrConversationMembership() {
        Principal user = new UsernamePasswordAuthenticationToken(User.builder().id(1L).build(), null, List.of());
        assertForbidden(frame(StompCommand.SUBSCRIBE, user, "/topic/users/2/messages", null));
        assertForbidden(frame(StompCommand.SUBSCRIBE, user, "/topic/conversations/20/update", null));
        when(members.findByConversationIdAndUserId(10L, 1L))
                .thenReturn(Optional.of(ConversationMember.builder().build()));
        assertDoesNotThrow(() -> interceptor.preSend(
                frame(StompCommand.SUBSCRIBE, user, "/topic/conversations/10/update", null), null));
    }

    @Test
    void clientsCannotPublishMessages() {
        assertForbidden(frame(StompCommand.SEND, null, "/topic/presence", null));
    }

    @Test
    void retainedSubscriptionStopsReceivingAfterRemoval() {
        User user = User.builder().id(1L).build();
        when(tokens.validateToken("good")).thenReturn(true);
        when(tokens.getUserIdFromJWT("good")).thenReturn(1L);
        when(users.findById(1L)).thenReturn(Optional.of(user));
        interceptor.preSend(frame(StompCommand.CONNECT, null, null, "Bearer good"), null);

        AtomicBoolean member = new AtomicBoolean(true);
        when(members.findByConversationIdAndUserId(10L, 1L)).thenAnswer(invocation ->
                member.get() ? Optional.of(ConversationMember.builder().build()) : Optional.empty());
        Principal principal = new UsernamePasswordAuthenticationToken(user, null, List.of());
        interceptor.preSend(frame(StompCommand.SUBSCRIBE, principal,
                "/topic/conversations/10/update", null), null);

        List<Message<byte[]>> deliveries = List.of(
                frame(StompCommand.MESSAGE, principal, "/topic/conversations/10", null),
                frame(StompCommand.MESSAGE, principal, "/topic/conversations/10/update", null),
                frame(StompCommand.MESSAGE, principal, "/topic/conversations/10/typing", null));
        for (Message<byte[]> delivery : deliveries) {
            assertEquals(delivery, interceptor.outboundInterceptor().preSend(delivery, null));
        }

        member.set(false); // The client deliberately leaves the old subscription active.
        for (Message<byte[]> delivery : deliveries) {
            assertEquals(null, interceptor.outboundInterceptor().preSend(delivery, null));
        }
    }
}
