package com.chatapp.backend.listener;

import com.chatapp.backend.dto.PresenceResponse;
import com.chatapp.backend.entity.User;
import com.chatapp.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class WebSocketEventListener {

    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        // Handshake Event
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String userIdStr = (String) headerAccessor.getSessionAttributes().get("userId");

        if (userIdStr != null) {
            try {
                Long userId = Long.parseLong(userIdStr);
                User user = userRepository.findById(userId).orElse(null);
                if (user != null) {
                    user.setIsOnline(false);
                    user.setLastSeenAt(LocalDateTime.now());
                    userRepository.save(user);

                    PresenceResponse presence = PresenceResponse.builder()
                            .userId(user.getId())
                            .isOnline(false)
                            .lastSeenAt(user.getLastSeenAt())
                            .build();

                    messagingTemplate.convertAndSend("/topic/presence", presence);
                }
            } catch (Exception ignored) {}
        }
    }
}