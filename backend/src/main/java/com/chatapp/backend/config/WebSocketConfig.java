package com.chatapp.backend.config;

import org.springframework.beans.factory.annotation.Value;
import com.chatapp.backend.security.StompAuthChannelInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.context.annotation.Configuration;
import java.util.Arrays;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompAuthChannelInterceptor stompAuth;

    @Value("${app.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}")
    private String allowedOrigins;

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(stompAuth);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Kênh broker để server bắn tin nhắn xuống client lắng nghe (Subscribe)
        config.enableSimpleBroker("/topic");
        // Tiền tố cho các request gửi từ client lên server xử lý (Publish)
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Điểm bắt tay (Handshake) WebSocket ban đầu giữa Client và Server
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(Arrays.stream(allowedOrigins.split(","))
                        .map(String::trim).filter(value -> !value.isEmpty()).toArray(String[]::new))
                .withSockJS();
    }
}