package com.chatapp.backend.security;

import com.chatapp.backend.entity.User;
import com.chatapp.backend.repository.ConversationMemberRepository;
import com.chatapp.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Xác thực ở STOMP CONNECT và phân quyền từng topic ở SUBSCRIBE.
 * SockJS handshake không truyền Authorization header, nên kiểm token STOMP.
 */
@Component
@RequiredArgsConstructor
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final Pattern USER_TOPIC = Pattern.compile("^/topic/users/(\\d+)/messages$");
    private static final Pattern CONVERSATION_TOPIC = Pattern.compile(
            "^/topic/conversations/(\\d+)(?:/(?:update|typing|theme))?$");

    private final JwtTokenProvider tokens;
    private final UserRepository users;
    private final ConversationMemberRepository members;
    private final Map<String, Long> authenticatedSessions = new ConcurrentHashMap<>();

    private final ChannelInterceptor outbound = new ChannelInterceptor() {
        @Override
        public Message<?> preSend(Message<?> message, MessageChannel channel) {
            return filterOutbound(message);
        }
    };

    public ChannelInterceptor outboundInterceptor() {
        return outbound;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor headers = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (headers == null || headers.getCommand() == null) return message;

        if (headers.getCommand() == StompCommand.CONNECT) {
            String authorization = headers.getFirstNativeHeader("Authorization");
            if (authorization == null || !authorization.startsWith("Bearer ")) {
                throw forbidden();
            }
            String token = authorization.substring(7);
            if (!tokens.validateToken(token)) throw forbidden();

            Long userId = tokens.getUserIdFromJWT(token);
            User user = users.findById(userId).orElseThrow(this::forbidden);
            headers.setUser(new UsernamePasswordAuthenticationToken(user, null, Collections.emptyList()));
            if (headers.getSessionId() != null) {
                authenticatedSessions.put(headers.getSessionId(), userId);
            }
            if (headers.getSessionAttributes() != null) {
                headers.getSessionAttributes().put("userId", userId.toString());
            }
            return message;
        }

        if (headers.getCommand() == StompCommand.DISCONNECT) {
            if (headers.getSessionId() != null) authenticatedSessions.remove(headers.getSessionId());
            return message;
        }

        if (headers.getCommand() == StompCommand.SUBSCRIBE) {
            Long authenticatedId = userId(headers.getUser());
            String destination = headers.getDestination();
            if ("/topic/presence".equals(destination)) return message;

            Matcher userTopic = USER_TOPIC.matcher(destination == null ? "" : destination);
            if (userTopic.matches() && authenticatedId.equals(Long.valueOf(userTopic.group(1)))) return message;

            Matcher conversationTopic = CONVERSATION_TOPIC.matcher(destination == null ? "" : destination);
            if (conversationTopic.matches()) {
                Long conversationId = Long.valueOf(conversationTopic.group(1));
                if (members.findByConversationIdAndUserId(conversationId, authenticatedId).isPresent()) return message;
            }
            throw forbidden();
        }

        // Không có @MessageMapping phía server; client không được tự publish vào broker.
        if (headers.getCommand() == StompCommand.SEND) throw forbidden();
        return message;
    }

    /** Runs on every broker delivery, including subscriptions retained after a member is removed. */
    Message<?> filterOutbound(Message<?> message) {
        StompHeaderAccessor headers = StompHeaderAccessor.wrap(message);
        String destination = headers.getDestination();
        if (destination == null) return message;
        if ("/topic/presence".equals(destination)) return message;

        Long userId = authenticatedSessions.get(headers.getSessionId());
        if (userId == null) return null;

        Matcher userTopic = USER_TOPIC.matcher(destination);
        if (userTopic.matches()) {
            return userId.equals(Long.valueOf(userTopic.group(1))) ? message : null;
        }

        Matcher conversationTopic = CONVERSATION_TOPIC.matcher(destination);
        if (conversationTopic.matches()) {
            Long conversationId = Long.valueOf(conversationTopic.group(1));
            return members.findByConversationIdAndUserId(conversationId, userId).isPresent()
                    ? message : null;
        }
        return null;
    }

    private Long userId(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken auth
                && auth.getPrincipal() instanceof User user) return user.getId();
        throw forbidden();
    }

    private ResponseStatusException forbidden() {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền truy cập kênh realtime");
    }
}
