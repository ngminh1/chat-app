package com.chatapp.backend.security;

import com.chatapp.backend.config.WebSocketConfig;
import com.chatapp.backend.config.SecurityConfig;
import com.chatapp.backend.entity.ConversationMember;
import com.chatapp.backend.entity.User;
import com.chatapp.backend.repository.ConversationMemberRepository;
import com.chatapp.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration;
import org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.springframework.web.socket.sockjs.client.SockJsClient;
import org.springframework.web.socket.sockjs.client.WebSocketTransport;

import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest(classes = WebSocketDeliveryIntegrationTest.TestApp.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class WebSocketDeliveryIntegrationTest {
    @SpringBootConfiguration
    @EnableAutoConfiguration(exclude = {
            DataSourceAutoConfiguration.class,
            HibernateJpaAutoConfiguration.class
    })
    @Import({WebSocketConfig.class, StompAuthChannelInterceptor.class,
            SecurityConfig.class, JwtAuthenticationFilter.class})
    static class TestApp {
        @Bean JwtTokenProvider tokens() { return mock(JwtTokenProvider.class); }
        @Bean UserRepository users() { return mock(UserRepository.class); }
        @Bean ConversationMemberRepository members() { return mock(ConversationMemberRepository.class); }
    }

    @LocalServerPort int port;
    @Autowired JwtTokenProvider tokens;
    @Autowired UserRepository users;
    @Autowired ConversationMemberRepository members;
    @Autowired SimpMessagingTemplate broker;

    @Test
    void oldSubscriptionReceivesNothingAfterMembershipRemoval() throws Exception {
        AtomicBoolean isMember = new AtomicBoolean(true);
        User user = User.builder().id(1L).build();
        when(tokens.validateToken("good")).thenReturn(true);
        when(tokens.getUserIdFromJWT("good")).thenReturn(1L);
        when(users.findById(1L)).thenReturn(Optional.of(user));
        when(members.findByConversationIdAndUserId(10L, 1L)).thenAnswer(invocation ->
                isMember.get() ? Optional.of(ConversationMember.builder().build()) : Optional.empty());

        var transport = new SockJsClient(List.of(new WebSocketTransport(new StandardWebSocketClient())));
        var client = new WebSocketStompClient(transport);
        var scheduler = new ThreadPoolTaskScheduler();
        scheduler.initialize();
        client.setTaskScheduler(scheduler);
        LinkedBlockingQueue<String> received = new LinkedBlockingQueue<>();
        StompHeaders connect = new StompHeaders();
        connect.add("Authorization", "Bearer good");
        StompSession session = client.connectAsync("http://localhost:" + port + "/ws",
                new WebSocketHttpHeaders(), connect, new StompSessionHandlerAdapter() {})
                .get(10, TimeUnit.SECONDS);
        try {
            StompHeaders subscribe = new StompHeaders();
            subscribe.setDestination("/topic/conversations/10/update");
            session.subscribe(subscribe, new StompFrameHandler() {
                @Override public Type getPayloadType(StompHeaders headers) { return byte[].class; }
                @Override public void handleFrame(StompHeaders headers, Object payload) {
                    received.add(new String((byte[]) payload, StandardCharsets.UTF_8));
                }
            });
            Thread.sleep(300);

            broker.convertAndSend("/topic/conversations/10/update", "before");
            assertEquals("before", received.poll(5, TimeUnit.SECONDS));

            isMember.set(false); // Keep the same live STOMP subscription on purpose.
            broker.convertAndSend("/topic/conversations/10/update", "after");
            assertNull(received.poll(1, TimeUnit.SECONDS));
        } finally {
            session.disconnect();
            client.stop();
            scheduler.shutdown();
        }
    }
}
