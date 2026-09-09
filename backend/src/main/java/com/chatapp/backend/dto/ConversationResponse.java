package com.chatapp.backend.dto;

import com.chatapp.backend.entity.ConversationType;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversationResponse {
    private Long conversationId;
    private ConversationType type;
    private String title;
    private String avatarUrl;
    private String theme;
    private int memberCount;
    private UserResponse otherUser;
    private String lastMessage;
    private LocalDateTime lastMessageTime;
    private long unreadCount;
}